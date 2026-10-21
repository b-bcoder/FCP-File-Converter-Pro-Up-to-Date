import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { convertMediaLocal } from './electron-convert';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for file operations and conversions
ipcMain.handle('select-files', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  return result.filePaths;
});

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0];
});

ipcMain.handle(
  'convert-media',
  async (event, { inputPath, outputPath, format, targetDimensions }) => {
    try {
      await convertMediaLocal(inputPath, outputPath, format, targetDimensions, (progress) => {
        mainWindow?.webContents.send('conversion-progress', { progress, inputPath });
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle('get-home-dir', async () => {
  return app.getPath('home');
});

ipcMain.handle('get-temp-dir', async () => {
  return app.getPath('temp');
});
