import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';
import { analyzeAllNotes } from '../services/linkAnalyzer.js';

export function registerLinkIPC(getVaultPath: () => string, db: DatabaseType): void {
  ipcMain.handle('note:getBacklinks', (_event, title: string) => {
    const vaultPath = getVaultPath();
    const { backlinksMap } = analyzeAllNotes(vaultPath, db);
    return backlinksMap.get(title) ?? [];
  });

  ipcMain.handle('note:getLinkGraph', () => {
    const vaultPath = getVaultPath();
    const { graph } = analyzeAllNotes(vaultPath, db);
    return graph;
  });
}
