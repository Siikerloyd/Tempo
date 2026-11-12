import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  chooseAlarmAudio: () => ipcRenderer.invoke('choose-alarm-audio'),
  getAlarmAudio: () => ipcRenderer.invoke('get-alarm-audio'),
  resetAlarmAudio: () => ipcRenderer.invoke('reset-alarm-audio'),
  setMiniMode: (isMiniMode) => ipcRenderer.send('set-mini-mode', isMiniMode),
  setTimerTitle: (title) => ipcRenderer.send('set-timer-title', title),
  setBackgroundThrottling: (shouldThrottle) =>
    ipcRenderer.send('set-background-throttling', shouldThrottle)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
