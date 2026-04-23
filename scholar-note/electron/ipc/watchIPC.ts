// electron/ipc/watchIPC.ts
// File watcher IPC — start/stop watching a vault directory

import { ipcMain, type BrowserWindow } from 'electron';
import { watch, type FSWatcher } from 'chokidar';

let watcher: FSWatcher | null = null;

/** Close the active watcher (used during app shutdown). */
export async function closeWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

// ---------------------------------------------------------------------------
// Register handlers — call once with the main BrowserWindow reference
// ---------------------------------------------------------------------------

export function registerWatchIPC(getMainWindow: () => BrowserWindow | null): void {
  // -----------------------------------------------------------------------
  // watcher:start — begin watching the vault directory
  // -----------------------------------------------------------------------
  ipcMain.handle('watcher:start', async (_event, vaultPath: string): Promise<void> => {
    // Stop existing watcher first
    if (watcher) {
      await watcher.close();
      watcher = null;
    }

    watcher = watch(vaultPath, {
      ignored: [
        /(^|[/\\])\../,          // dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/pdfs/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('change', (filePath: string) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('file:changed', filePath);
      }
    });

    watcher.on('add', (filePath: string) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('file:added', filePath);
      }
    });

    watcher.on('error', (error: unknown) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        const message = error instanceof Error ? error.message : 'Watcher error';
        win.webContents.send('watcher:error', message);
      }
    });
  });

  // -----------------------------------------------------------------------
  // watcher:stop — stop watching
  // -----------------------------------------------------------------------
  ipcMain.handle('watcher:stop', async (): Promise<void> => {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
  });
}
