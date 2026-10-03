import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('farmclawDesktop', {
  bootstrap: () => ipcRenderer.invoke('farmclaw:bootstrap'),
  dshRequest: (method: string, payload: unknown) => ipcRenderer.invoke('farmclaw:dsh-request', method, payload),
  onDshFrame: (listener: (frame: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, frame: unknown) => listener(frame)
    ipcRenderer.on('farmclaw:dsh-frame', handler)
    return () => ipcRenderer.removeListener('farmclaw:dsh-frame', handler)
  },
  onRuntimeReady: (listener: () => void) => {
    const handler = () => listener()
    ipcRenderer.on('farmclaw:runtime-ready', handler)
    return () => ipcRenderer.removeListener('farmclaw:runtime-ready', handler)
  },
  onRuntimeError: (listener: (message: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => listener(message)
    ipcRenderer.on('farmclaw:runtime-error', handler)
    return () => ipcRenderer.removeListener('farmclaw:runtime-error', handler)
  }
})
