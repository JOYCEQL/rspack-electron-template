import { contextBridge, ipcRenderer } from 'electron';
console.log(11);
contextBridge.exposeInMainWorld('electronAPI', {
	getDesktopSources: () => ipcRenderer.invoke('GET_DESKTOP_SOURCES'),
	startOverlay: () => ipcRenderer.send('start-overlay'),
	stopOverlay: () => ipcRenderer.send('stop-overlay'),
});
