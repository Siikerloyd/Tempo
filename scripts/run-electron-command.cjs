const fs = require('node:fs')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')

const [command, ...args] = process.argv.slice(2)

if (!command) {
  console.error('Usage: node scripts/run-electron-command.cjs <command> [...args]')
  process.exit(1)
}

// ELECTRON_RUN_AS_NODE makes Electron behave like Node, so the main process
// receives a string from require('electron') instead of the Electron API.
delete process.env.ELECTRON_RUN_AS_NODE

// Auto-heal: verify Electron binary is installed before running commands
try {
  const electronPkgDir = path.dirname(require.resolve('electron/package.json'))
  const pathTxt = path.join(electronPkgDir, 'path.txt')
  if (!fs.existsSync(pathTxt)) {
    console.log('Tempo: Electron binary missing. Running Electron installer...')
    const installScript = path.join(electronPkgDir, 'install.js')
    if (fs.existsSync(installScript)) {
      execFileSync(process.execPath, [installScript], { stdio: 'inherit' })
    }
  }
} catch {
  // If electron cannot be resolved yet, continue and let the command report its error
}

const isWindows = process.platform === 'win32'
const quoteWindowsArg = (value) => {
  const text = String(value)
  return /[&|<>^"%\s]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const child = isWindows
  ? spawn([command, ...args].map(quoteWindowsArg).join(' '), {
      stdio: 'inherit',
      env: process.env,
      shell: true
    })
  : spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      shell: false
    })

child.on('error', (error) => {
  console.error(`Failed to start ${command}:`, error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
