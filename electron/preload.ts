const { contextBridge, ipcRenderer } = require('electron')

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: any, ...args: any[]) => void) {
    return ipcRenderer.on(channel, (event: any, ...args: any[]) => listener(event, ...args))
  },
  off(channel: string, listener: (event: any, ...args: any[]) => void) {
    return ipcRenderer.off(channel, listener)
  },
  send(channel: string, ...args: any[]) {
    return ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: any[]) {
    return ipcRenderer.invoke(channel, ...args)
  },

  // You can expose other APTs you need here.
  // ...
})

// 暴露窗口控制 API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
})
