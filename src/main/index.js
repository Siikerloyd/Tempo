import { app, shell, BrowserWindow, ipcMain, Menu, dialog, protocol, net } from 'electron'
import { basename, join } from 'path'
import { readFile, stat, unlink, writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const ALARM_AUDIO_CONFIG = 'tempo-alarm-audio.json'
const MAX_ALARM_AUDIO_BYTES = 25 * 1024 * 1024
const ALARM_PROTOCOL_URL = 'tempo://alarm'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tempo',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

const getAlarmAudioConfigPath = () => join(app.getPath('userData'), ALARM_AUDIO_CONFIG)

const readSavedAlarmPath = async () => {
  const rawConfig = await readFile(getAlarmAudioConfigPath(), 'utf8')
  const config = JSON.parse(rawConfig)
  if (!config?.filePath) return null

  const fileStats = await stat(config.filePath)
  if (fileStats.size > MAX_ALARM_AUDIO_BYTES) {
    throw new Error('Alarm audio files must be 25 MB or smaller.')
  }

  return {
    filePath: config.filePath,
    fileName: config.fileName || basename(config.filePath),
    version: fileStats.mtimeMs
  }
}

const createAudioPayload = async (filePath) => {
  const fileStats = await stat(filePath)
  if (fileStats.size > MAX_ALARM_AUDIO_BYTES) {
    throw new Error('Alarm audio files must be 25 MB or smaller.')
  }

  return {
    fileName: basename(filePath),
    audioUrl: `${ALARM_PROTOCOL_URL}?v=${fileStats.mtimeMs}`
  }
}

const readAlarmAudioConfig = async () => {
  try {
    const saved = await readSavedAlarmPath()
    if (!saved) return null

    return {
      fileName: saved.fileName,
      audioUrl: `${ALARM_PROTOCOL_URL}?v=${saved.version}`
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Could not load the saved alarm audio:', error.message)
    }
    return null
  }
}

const writeAlarmAudioConfig = async (filePath, audio) => {
  await writeFile(
    getAlarmAudioConfigPath(),
    JSON.stringify({ filePath, fileName: audio.fileName }, null, 2),
    'utf8'
  )
}

let mainWindow = null

function createWindow() {
  // Completely disable any native menus
  Menu.setApplicationMenu(null)

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 450,
    height: 370,
    minWidth: 450,
    minHeight: 370,
    maxWidth: 450,
    maxHeight: 370,
    resizable: false,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    hasShadow: true,
    icon,
    title: 'Tempo',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: true
    }
  })
  mainWindow.removeMenu()
  mainWindow.setMenu(null)
  mainWindow.setAlwaysOnTop(true, 'screen')

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Only one copy of the desktop app should run at a time.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // Allow audio to autoplay without user gesture requirements (essential for alarms/timers)
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.tempo.app')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    protocol.handle('tempo', async () => {
      try {
        const saved = await readSavedAlarmPath()
        if (!saved?.filePath) {
          return new Response('Not found', { status: 404 })
        }
        return net.fetch(pathToFileURL(saved.filePath).href)
      } catch {
        return new Response('Not found', { status: 404 })
      }
    })

    ipcMain.handle('get-alarm-audio', async () => readAlarmAudioConfig())

    ipcMain.handle('choose-alarm-audio', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Choose alarm sound',
        properties: ['openFile'],
        filters: [
          {
            name: 'Audio files',
            extensions: ['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'wav', 'webm']
          }
        ]
      })

      if (result.canceled || !result.filePaths[0]) {
        return { canceled: true }
      }

      try {
        const audio = await createAudioPayload(result.filePaths[0])
        await writeAlarmAudioConfig(result.filePaths[0], audio)
        return { canceled: false, ...audio }
      } catch (error) {
        console.warn('Could not load the selected alarm audio:', error.message)
        return { canceled: false, error: error.message }
      }
    })

    ipcMain.handle('reset-alarm-audio', async () => {
      await unlink(getAlarmAudioConfigPath()).catch((error) => {
        if (error.code !== 'ENOENT') {
          console.warn('Could not reset the saved alarm audio:', error.message)
        }
      })
      return { canceled: false }
    })

    // IPC test
    //ipcMain.on('ping', () => console.log('pong'))
    ipcMain.on('minimize-window', () => {
      const currentWindow = BrowserWindow.getFocusedWindow()
      if (currentWindow) {
        currentWindow.minimize()
      }
    })

    ipcMain.on('close-window', () => {
      const currentWindow = BrowserWindow.getFocusedWindow()
      if (currentWindow) {
        currentWindow.close()
      }
    })

    ipcMain.handle('toggle-always-on-top', () => {
      const currentWindow = BrowserWindow.getFocusedWindow()
      if (currentWindow) {
        const newState = !currentWindow.isAlwaysOnTop()
        currentWindow.setAlwaysOnTop(newState, 'screen')
        return newState
      }
      return true
    })

    ipcMain.on('set-mini-mode', (_event, isMiniMode) => {
      if (!mainWindow || mainWindow.isDestroyed()) return

      const size = isMiniMode ? { width: 200, height: 88 } : { width: 450, height: 370 }
      mainWindow.setMinimumSize(size.width, size.height)
      mainWindow.setMaximumSize(size.width, size.height)
      mainWindow.setSize(size.width, size.height)
    })

    ipcMain.on('set-timer-title', (event, title) => {
      if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return
      mainWindow.setTitle(typeof title === 'string' ? title.slice(0, 80) : 'Tempo')
    })

    ipcMain.on('set-background-throttling', (_event, shouldThrottle) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.setBackgroundThrottling(Boolean(shouldThrottle))
      }
    })

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
