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

// Auto-heal: ensure Electron binary is installed and registered
try {
  const electronPkgDir = path.dirname(require.resolve('electron/package.json'))
  const installScript = path.join(electronPkgDir, 'install.js')
  const pathTxt = path.join(electronPkgDir, 'path.txt')
  const platformExe =
    process.platform === 'win32'
      ? 'electron.exe'
      : process.platform === 'darwin'
        ? 'Electron.app/Contents/MacOS/Electron'
        : 'electron'
  const binaryPath = path.join(electronPkgDir, 'dist', platformExe)

  if (!fs.existsSync(binaryPath) || !fs.existsSync(pathTxt)) {
    console.log('Tempo: Installing Electron binary...')
    if (fs.existsSync(installScript)) {
      const cleanEnv = { ...process.env }
      delete cleanEnv.ELECTRON_RUN_AS_NODE
      execFileSync(process.execPath, [installScript], {
        cwd: electronPkgDir,
        stdio: 'inherit',
        env: cleanEnv
      })
    }
  }

  if (fs.existsSync(binaryPath)) {
    process.env.ELECTRON_EXEC_PATH = binaryPath
    if (!fs.existsSync(pathTxt)) {
      fs.writeFileSync(pathTxt, platformExe, 'utf-8')
    }
  }
} catch (error) {
  console.warn('Tempo: Could not auto-install Electron binary:', error.message)
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
