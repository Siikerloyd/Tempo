const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const electronPkgDir = path.dirname(require.resolve('electron/package.json'))
const electronPackage = require(path.join(electronPkgDir, 'package.json'))
const platform = process.env.npm_config_platform || process.platform
const arch = process.env.npm_config_arch || process.arch
const platformExe = ['darwin', 'mas'].includes(platform)
  ? 'Electron.app/Contents/MacOS/Electron'
  : platform === 'win32'
    ? 'electron.exe'
    : ['linux', 'freebsd', 'openbsd'].includes(platform)
      ? 'electron'
      : null

if (!platformExe) {
  console.error(`Tempo: Electron is not available for platform "${platform}".`)
  process.exit(1)
}

const electronPath = path.join(electronPkgDir, 'dist', platformExe)
const pathTxt = path.join(electronPkgDir, 'path.txt')
const resourcesPath = ['darwin', 'mas'].includes(platform)
  ? path.join(electronPkgDir, 'dist', 'Electron.app', 'Contents', 'Resources')
  : path.join(electronPkgDir, 'dist', 'resources')
const requiredFiles = [
  electronPath,
  pathTxt,
  path.join(electronPkgDir, 'dist', 'version'),
  path.join(resourcesPath, 'default_app.asar')
]
const hasCompleteElectronInstall = () => requiredFiles.every((filePath) => fs.existsSync(filePath))
const electronGetPath = require.resolve('@electron/get', { paths: [electronPkgDir] })
const { downloadArtifact } = require(electronGetPath)

const extractElectronArchive = async (archivePath, distPath) => {
  if (process.platform === 'win32') {
    execFileSync('tar', ['-xf', archivePath, '-C', distPath], { stdio: 'inherit' })
    return
  }

  const extractZip = require(require.resolve('extract-zip', { paths: [electronPkgDir] }))
  await extractZip(archivePath, { dir: distPath })
}

const ensureElectronInstall = async () => {
  if (hasCompleteElectronInstall()) {
    console.log('Tempo: Electron binary already present.')
    return true
  }

  console.log('Tempo: Electron installation is incomplete. Installing...')
  const localCache = path.resolve('.electron-cache')
  fs.mkdirSync(localCache, { recursive: true })

  try {
    const archivePath = await downloadArtifact({
      version: electronPackage.version,
      artifactName: 'electron',
      force: process.env.force_no_cache === 'true',
      cacheRoot: localCache,
      checksums:
        process.env.electron_use_remote_checksums ||
        process.env.npm_config_electron_use_remote_checksums
          ? undefined
          : require(path.join(electronPkgDir, 'checksums.json')),
      platform,
      arch
    })

    const distPath = path.join(electronPkgDir, 'dist')
    fs.mkdirSync(distPath, { recursive: true })
    await extractElectronArchive(archivePath, distPath)
    fs.writeFileSync(pathTxt, platformExe, 'utf8')

    if (!hasCompleteElectronInstall()) {
      throw new Error('Electron archive was extracted without all required runtime files.')
    }

    console.log('Tempo: Electron binary installed successfully.')
    return true
  } catch (error) {
    console.error('Tempo: Failed to install Electron binary.')
    console.error(error.message)
    return false
  }
}

const installAppDependencies = () => {
  try {
    execFileSync(
      process.execPath,
      [path.resolve('node_modules/electron-builder/cli.js'), 'install-app-deps'],
      { stdio: 'inherit' }
    )
  } catch {
    // Non-fatal: app has no native addons
  }
}

ensureElectronInstall().then((installed) => {
  if (installed) installAppDependencies()
  else process.exitCode = 1
})
