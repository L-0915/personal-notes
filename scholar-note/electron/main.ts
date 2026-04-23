// electron/main.ts
// Electron main process — window creation, IPC registration, lifecycle

import { app, BrowserWindow, ipcMain, Menu, protocol, net } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Register vault:// custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'vault', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, standard: true } },
]);

// Import IPC registration
import { registerFileIPC } from './ipc/fileIPC.js';
import { registerPaperIPC } from './ipc/paperIPC.js';
import { registerWatchIPC, closeWatcher } from './ipc/watchIPC.js';
import { registerDbIPC } from './ipc/dbIPC.js';
import { registerExportIPC } from './ipc/exportIPC.js';
import { initDatabase } from './services/database.js';

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

const preloadPath = path.join(__dirname, 'preload.js');

let mainWindow: BrowserWindow | null = null;

/** Resolve the default vault path: D:\ScholarNote, fallback to ~/Documents/ScholarNote */
function getDefaultVaultPath(): string {
  try {
    const dRoot = path.resolve('D:\\');
    fs.accessSync(dRoot, fs.constants.W_OK);
    return path.join(dRoot, 'ScholarNote');
  } catch {
    return path.join(os.homedir(), 'Documents', 'ScholarNote');
  }
}

/** Current vault path (persists for the session). */
let vaultPath = getDefaultVaultPath();

/** Ensure the vault directory structure exists. */
function ensureVaultDirs(vp: string): void {
  const dirs = ['papers', 'pdfs', 'templates', 'images'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(vp, dir), { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarOverlay: process.platform === 'win32' ? { height: 36 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Graceful show when ready — capture reference locally to avoid race
  const win = mainWindow;
  mainWindow.once('ready-to-show', () => {
    if (win && !win.isDestroyed()) {
      win.show();
    }
  });

  // Load the appropriate URL/file
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC: vault path getter / setter
// ---------------------------------------------------------------------------

function registerVaultIPC(): void {
  ipcMain.handle('get-vault-path', (): string => vaultPath);

  ipcMain.handle('set-vault-path', (_event, newPath: string): { success: boolean; error?: string } => {
    // Basic sanity validation
    if (typeof newPath !== 'string' || newPath.trim().length === 0) {
      return { success: false, error: 'Invalid vault path' };
    }
    const resolved = path.resolve(newPath);
    // Verify the parent directory exists
    if (!fs.existsSync(path.dirname(resolved))) {
      return { success: false, error: 'Parent directory does not exist' };
    }
    vaultPath = resolved;
    ensureVaultDirs(vaultPath);
    return { success: true };
  });

  ipcMain.handle('get-app-version', (): string => app.getVersion());

  // Settings persistence
  ipcMain.handle('settings:read', (): Record<string, unknown> => {
    const settingsPath = path.join(vaultPath, 'scholarnote.config.json');
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch { /* return defaults */ }
    return { editorFontSize: 16, autoSaveInterval: 1, apiSourceOrder: ['arxiv', 'crossref', 'semantic-scholar'] };
  });

  ipcMain.handle('settings:write', (_event, settings: Record<string, unknown>): { success: boolean } => {
    const settingsPath = path.join(vaultPath, 'scholarnote.config.json');
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}

// ---------------------------------------------------------------------------
// IPC: Backup
// ---------------------------------------------------------------------------

function registerBackupIPC(): void {
  ipcMain.handle('backup:now', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const backupDir = path.join(vaultPath, '.backup');
      fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(backupDir, timestamp);
      fs.mkdirSync(dest, { recursive: true });

      // Copy all .md files and database
      function copyRecursive(src: string, dst: string): void {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const srcPath = path.join(src, entry.name);
          const dstPath = path.join(dst, entry.name);
          if (entry.isDirectory()) {
            fs.mkdirSync(dstPath, { recursive: true });
            copyRecursive(srcPath, dstPath);
          } else if (entry.isFile()) {
            fs.copyFileSync(srcPath, dstPath);
          }
        }
      }
      copyRecursive(vaultPath, dest);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : '备份失败' };
    }
  });

  ipcMain.handle('backup:list', async (): Promise<Array<{ name: string; path: string; createdAt: number }>> => {
    const backupDir = path.join(vaultPath, '.backup');
    if (!fs.existsSync(backupDir)) return [];
    try {
      return fs.readdirSync(backupDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => ({
          name: e.name,
          path: path.join(backupDir, e.name),
          createdAt: new Date(e.name.replace(/-/g, (m, i) => i > 9 ? (i === 10 || i === 13 ? ':' : '.') : m)).getTime(),
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // Register vault:// protocol handler for serving local files (images, PDFs, etc.)
  protocol.handle('vault', (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.join(vaultPath, relativePath);
    return net.fetch(`file:///${filePath.replace(/\\/g, '/')}`);
  });

  // Ensure vault directories
  ensureVaultDirs(vaultPath);

  // Initialize database
  const dbPath = path.join(vaultPath, 'scholarnote.db');
  const db = initDatabase(dbPath);

  // Register IPC handlers
  registerFileIPC(() => vaultPath, db);
  registerPaperIPC(() => vaultPath, db);
  registerWatchIPC(() => mainWindow);
  registerDbIPC(db);
  registerVaultIPC();
  registerBackupIPC();
  registerExportIPC();

  // Create the main window
  createWindow();

  // Remove default menu bar
  Menu.setApplicationMenu(null);
});

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

app.on('before-quit', () => {
  closeWatcher().catch(() => {});
});
