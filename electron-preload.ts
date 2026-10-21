import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  convertMedia: (config: any) => ipcRenderer.invoke('convert-media', config),
  onConversionProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('conversion-progress', (event, data) => callback(data));
  },
  removeConversionProgressListener: () => {
    ipcRenderer.removeAllListeners('conversion-progress');
  },
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
});
