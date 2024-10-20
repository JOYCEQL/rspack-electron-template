const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: path.join(__dirname, './preload.mjs'),
			nodeIntegration: true,
			contextIsolation: true, // 注意
		},
	});

	if (isDev) {
		win.loadURL('http://localhost:3000');
		win.webContents.openDevTools();
	} else {
		win.loadFile(path.join(__dirname, '../dist/index.html'));
	}

	ipcMain.handle('GET_DESKTOP_SOURCES', async () => {
		return await desktopCapturer.getSources({ types: ['window', 'screen'] });
	});

	let overlayWindow;

	ipcMain.on('start-overlay', () => {
		if (!overlayWindow) {
			const { width, height } = screen.getPrimaryDisplay().workAreaSize; // 获取主显示器的工作区宽高
			overlayWindow = new BrowserWindow({
				width,
				height,
				transparent: true,
				frame: false,
				alwaysOnTop: true,
				webPreferences: {
					contextIsolation: true,
					enableRemoteModule: false,
					nodeIntegration: false,
				},
			});
			overlayWindow.loadURL('file://' + path.join(__dirname, 'border.html'));
			overlayWindow.setIgnoreMouseEvents(true); // 点击事件穿透
		}
	});

	ipcMain.on('stop-overlay', () => {
		if (overlayWindow) {
			overlayWindow.close();
			overlayWindow = null;
		}
	});
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
