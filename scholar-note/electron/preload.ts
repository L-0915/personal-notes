// electron/preload.ts
// Context bridge — expose a safe, typed API to the renderer process

import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // -- File system ----------------------------------------------------------
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', filePath, content),
  listFiles: (dirPath: string) => ipcRenderer.invoke('file:list', dirPath),
  listFileTree: () => ipcRenderer.invoke('file:listTree'),
  createFolder: (folderPath: string) => ipcRenderer.invoke('folder:create', folderPath),
  renameFolder: (oldPath: string, newName: string) => ipcRenderer.invoke('folder:rename', oldPath, newName),
  deleteFolder: (folderPath: string) => ipcRenderer.invoke('folder:delete', folderPath),

  // -- Database -------------------------------------------------------------
  dbGetAllPapers: () => ipcRenderer.invoke('db:getAllPapers'),
  dbGetPaper: (id: number) => ipcRenderer.invoke('db:getPaper', id),
  dbSearchPapers: (query: string) => ipcRenderer.invoke('db:searchPapers', query),
  dbUpdatePaper: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updatePaper', id, data),
  dbDeletePaper: (id: number) => ipcRenderer.invoke('db:deletePaper', id),
  dbGetTags: () => ipcRenderer.invoke('db:getTags'),
  dbGetPapersByTag: (tag: string) => ipcRenderer.invoke('db:getPapersByTag', tag),
  dbGetPapersByStatus: (status: string) => ipcRenderer.invoke('db:getPapersByStatus', status),

  // -- Paper import & PDF ---------------------------------------------------
  importPaper: (urlOrDoi: string) => ipcRenderer.invoke('paper:import', urlOrDoi),
  openLocalFile: (filePath: string) => ipcRenderer.invoke('file:openLocal', filePath),

  // -- Local file import ----------------------------------------------------
  importLocalMd: () => ipcRenderer.invoke('import:localMd'),
  createNote: (title: string) => ipcRenderer.invoke('file:createNote', title),

  // -- File watcher ---------------------------------------------------------
  deleteFile: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
  showInExplorer: (filePath: string) => ipcRenderer.invoke('file:showInExplorer', filePath),
  startWatcher: (vaultPath: string) => ipcRenderer.invoke('watcher:start', vaultPath),
  stopWatcher: () => ipcRenderer.invoke('watcher:stop'),

  onFileChanged: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file:changed', listener);
    return () => ipcRenderer.removeListener('file:changed', listener);
  },

  onFileAdded: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file:added', listener);
    return () => ipcRenderer.removeListener('file:added', listener);
  },

  // -- App info & vault -----------------------------------------------------
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  selectVault: () => ipcRenderer.invoke('dialog:selectVault'),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  setVaultPath: (newPath: string) => ipcRenderer.invoke('set-vault-path', newPath),

  // -- Settings -------------------------------------------------------------
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:write', settings),

  // -- Trash -----------------------------------------------------------------
  trashList: () => ipcRenderer.invoke('trash:list'),
  trashRestore: (trashItemPath: string) => ipcRenderer.invoke('trash:restore', trashItemPath),
  trashPermanentDelete: (trashItemPath: string) => ipcRenderer.invoke('trash:permanentDelete', trashItemPath),
  trashEmpty: () => ipcRenderer.invoke('trash:empty'),

  // -- Image -----------------------------------------------------------------
  saveImage: (base64Data: string, ext: string) => ipcRenderer.invoke('image:save', base64Data, ext),

  // -- Drag-drop import -----------------------------------------------------
  importDropFiles: (filePaths: string[]) => ipcRenderer.invoke('import:dropFiles', filePaths),

  // -- Backup ---------------------------------------------------------------
  backupNow: () => ipcRenderer.invoke('backup:now'),
  backupList: () => ipcRenderer.invoke('backup:list'),

  // -- Export ---------------------------------------------------------------
  exportNote: (format: string, markdown: string, title: string) =>
    ipcRenderer.invoke('export:note', format, markdown, title),
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
