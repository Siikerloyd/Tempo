const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

// ─── Ensure Electron binary is installed ────────────────────────────────────
const electronPkgDir = path.dirname(require.resolve('electron/package.json'))
const platformExe =
  process.platform === 'win32'
    ? 'electron.exe'
    : process.platform === 'darwin'
      ? 'Electron.app/Contents/MacOS/Electron'
      : 'electron'
const binaryPath = path.join(electronPkgDir, 'dist', platformExe)
const pathTxt = path.join(electronPkgDir, 'path.txt')

if (!fs.existsSync(binaryPath) || !fs.existsSync(pathTxt)) {
  console.log('Tempo: Electron binary not found. Installing...')

  // Use a local writable cache so EPERM on system cache does not block download
  const localCache = path.resolve('.electron-cache')
  fs.mkdirSync(localCache, { recursive: true })

  // Build a clean env: remove variables that cause electron install.js to skip
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD

  // Point @electron/get at our local writable cache
  env.electron_config_cache = localCache

  try {
    execFileSync(process.execPath, [path.join(electronPkgDir, 'install.js')], {
      cwd: electronPkgDir,
      stdio: 'inherit',
      env
    })
    console.log('Tempo: Electron binary installed successfully.')
  } catch (err) {
    console.error('Tempo: Failed to install Electron binary.')
    console.error(err.message)
    process.exit(1)
  }
} else {
  console.log('Tempo: Electron binary already present.')
}

// ─── Rebuild native addons for the installed Electron version ────────────────
try {
  execFileSync(
    process.execPath,
    [path.resolve('node_modules/electron-builder/cli.js'), 'install-app-deps'],
    { stdio: 'inherit' }
  )
} catch {
  // Non-fatal: app has no native addons
}
