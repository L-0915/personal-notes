import type { Paper, Tag, SearchResult, ReadingStatus } from './types';

export interface ElectronAPI {
  readFile: (filePath: string) => Promise<string | { error: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
  listFiles: (dirPath: string) => Promise<string[]>;
  dbGetAllPapers: () => Promise<Paper[]>;
  dbGetPaper: (id: number) => Promise<Paper | undefined>;
  dbSearchPapers: (query: string) => Promise<SearchResult[]>;
  dbUpdatePaper: (id: number, data: Partial<Paper>) => Promise<boolean>;
  dbDeletePaper: (id: number) => Promise<boolean>;
  dbGetTags: () => Promise<Tag[]>;
  dbGetPapersByTag: (tag: string) => Promise<Paper[]>;
  dbGetPapersByStatus: (status: ReadingStatus) => Promise<Paper[]>;
  importPaper: (urlOrDoi: string) => Promise<{ success: boolean; notePath?: string; error?: string }>;
  openLocalFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  importLocalMd: () => Promise<{ success: boolean; imported: Array<{ title: string; filePath: string }>; errors: string[] }>;
  createNote: (title: string, folderPath?: string) => Promise<{ success: boolean; notePath?: string; error?: string }>;
  startWatcher: (vaultPath: string) => Promise<void>;
  stopWatcher: () => Promise<void>;
  onFileChanged: (callback: (filePath: string) => void) => () => void;
  onFileAdded: (callback: (filePath: string) => void) => () => void;
  getAppVersion: () => Promise<string>;
  selectVault: () => Promise<string | null>;
  getVaultPath: () => Promise<string>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  renameFile: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  showInExplorer: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  setVaultPath: (newPath: string) => Promise<{ success: boolean; error?: string }>;
  readSettings: () => Promise<Record<string, unknown>>;
  writeSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;
  trashList: () => Promise<Array<{ name: string; originalName: string; path: string; deletedAt: number }>>;
  trashRestore: (trashItemPath: string) => Promise<{ success: boolean; error?: string }>;
  trashPermanentDelete: (trashItemPath: string) => Promise<{ success: boolean; error?: string }>;
  trashEmpty: () => Promise<{ success: boolean; error?: string }>;
  saveImage: (base64Data: string, ext: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  importDropFiles: (filePaths: string[]) => Promise<{ success: boolean; imported: number; errors: string[] }>;
  backupNow: () => Promise<{ success: boolean; error?: string }>;
  backupList: () => Promise<Array<{ name: string; path: string; createdAt: number }>>;
  exportNote: (format: string, markdown: string, title: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  listFileTree: () => Promise<FileTreeNode[]>;
  createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  renameFolder: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  deleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  getBacklinks: (title: string) => Promise<BacklinkResult[]>;
  getLinkGraph: () => Promise<LinkGraph>;
}

interface BacklinkResult {
  title: string;
  abstract: string | null;
  year: number | null;
  filePath: string;
}

interface LinkGraphNode {
  id: number;
  title: string;
  filePath: string;
}

interface LinkGraphEdge {
  source: string;
  target: string;
}

interface LinkGraph {
  nodes: LinkGraphNode[];
  links: LinkGraphEdge[];
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
