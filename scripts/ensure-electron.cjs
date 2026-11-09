const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

try {
  const electronPkgDir = path.dirname(require.resolve('electron/package.json'))
  const pathTxt = path.join(electronPkgDir, 'path.txt')
  if (!fs.existsSync(pathTxt)) {
    console.log('Tempo: Installing Electron binary...')
    const installScript = path.join(electronPkgDir, 'install.js')
    if (fs.existsSync(installScript)) {
      execFileSync(process.execPath, [installScript], { stdio: 'inherit' })
    }
  }
} catch (error) {
  console.warn('Tempo: Could not verify Electron installation:', error.message)
}
