const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200, height: 800,
        webPreferences: { nodeIntegration: true }
    });
    // CARICA IL FILE LOCALE, NON IL LOCALHOST!
    win.loadFile(path.join(__dirname, 'dist/index.html'));
}
app.whenReady().then(createWindow);
win.loadFile(path.join(__dirname, 'dist', 'index.html'));
