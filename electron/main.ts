const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: typeof BrowserWindow | null

function createWindow() {
  // 确定 preload 文件的正确路径
  const preloadPath = app.isPackaged 
    ? path.join(__dirname, 'preload.js') 
    : path.join(__dirname, '../dist-electron/preload.js')
  
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    frame: false, // 去掉原生标题栏
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: preloadPath,
    },
    show: false,
  })

  // 添加开发者工具快捷键支持
  win.webContents.on('before-input-event', (event: any, input: any) => {
    // F12 或 Ctrl+Shift+I 打开/关闭开发者工具
    if (input.key === 'F12' || 
        (input.control && input.shift && input.key === 'I')) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools()
      }
    }
  })

  // 窗口准备好后显示
  win.once('ready-to-show', () => {
    if (win) {
      win.show()
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // 检查是否在开发模式
  const isDev = process.env.NODE_ENV === 'development'
  const hasDevServer = VITE_DEV_SERVER_URL && VITE_DEV_SERVER_URL !== 'http://localhost:5173'
  
  if (isDev && hasDevServer) {
    // 开发模式
    win.webContents.session.clearCache()
    win.webContents.session.clearStorageData()
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.reloadIgnoringCache()
  } else {
    // 生产模式
    const indexPath = path.join(RENDERER_DIST, 'index.html')
    win.loadFile(indexPath)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 处理窗口控制的 IPC 事件
ipcMain.handle('window-minimize', () => {
  if (win) {
    win.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (win) {
    win.close()
  }
})

ipcMain.handle('window-is-maximized', () => {
  return win ? win.isMaximized() : false
})
