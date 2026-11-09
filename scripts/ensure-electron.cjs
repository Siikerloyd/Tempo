const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

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
      execFileSync(process.execPath, [installScript], { stdio: 'inherit' })
    }
  }

  if (fs.existsSync(binaryPath) && !fs.existsSync(pathTxt)) {
    fs.writeFileSync(pathTxt, platformExe, 'utf-8')
  }
} catch (error) {
  console.warn('Tempo: Could not verify Electron installation:', error.message)
}
