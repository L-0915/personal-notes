// electron/ipc/dbIPC.ts
// Database IPC handlers — wires database and search functions to the renderer

import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';
import {
  getAllPapers,
  getPaper,
  updatePaper,
  deletePaper,
  getTags,
  getPapersByTag,
  getPapersByStatus,
} from '../services/database.js';
import { searchPapers } from '../services/searchEngine.js';

// ---------------------------------------------------------------------------
// Register handlers — call once with the initialized database instance
// ---------------------------------------------------------------------------

export function registerDbIPC(db: DatabaseType): void {
  ipcMain.handle('db:getAllPapers', () => {
    return getAllPapers(db);
  });

  ipcMain.handle('db:getPaper', (_event, id: number) => {
    return getPaper(db, id);
  });

  ipcMain.handle('db:searchPapers', (_event, query: string) => {
    return searchPapers(db, query);
  });

  ipcMain.handle('db:updatePaper', (_event, id: number, data: Record<string, unknown>) => {
    return updatePaper(db, id, data);
  });

  ipcMain.handle('db:deletePaper', (_event, id: number) => {
    return deletePaper(db, id);
  });

  ipcMain.handle('db:getTags', () => {
    return getTags(db);
  });

  ipcMain.handle('db:getPapersByTag', (_event, tagId: number) => {
    return getPapersByTag(db, tagId);
  });

  ipcMain.handle('db:getPapersByStatus', (_event, status: string) => {
    return getPapersByStatus(db, status);
  });
}
