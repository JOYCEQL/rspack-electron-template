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
		try {
			// 获取主显示器的实际尺寸
			const primaryDisplay = screen.getPrimaryDisplay();
			const sources = await desktopCapturer.getSources({
				types: ['screen', 'window'], // 只获取屏幕源，不包括窗口
				// thumbnailSize: {
				// 	width: primaryDisplay.size.width,
				// 	height: primaryDisplay.size.height,
				// },
				fetchWindowIcons: true, // 捕获超出边界的内容
			});
			return sources;
		} catch (error) {
			console.error('Error getting sources:', error);
			throw error;
		}
	});

	let overlayWindow;

	ipcMain.on('start-overlay', () => {
		if (!overlayWindow) {
			const { width, height } = screen.getPrimaryDisplay().size;
			overlayWindow = new BrowserWindow({
				width,
				height,
				x: 0, // 设置窗口位置为左上角
				y: 0,
				transparent: true,
				frame: false,
				alwaysOnTop: true,
				fullscreen: true, // 启用全屏
				skipTaskbar: true, // 在任务栏中隐藏窗口
				webPreferences: {
					nodeIntegration: true,
					contextIsolation: false,
					enableRemoteModule: true,
					backgroundThrottling: false,
				},
				// 设置窗口类型为 dock（macOS）或 toolbar（Windows）
				type: process.platform === 'darwin' ? 'panel' : 'toolbar',
			});
			overlayWindow.setAlwaysOnTop(true, 'screen-saver');

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
