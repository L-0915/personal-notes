// electron/ipc/fileIPC.ts
// File system IPC handlers + local file import + note creation

import fs from 'node:fs';
import path from 'node:path';
import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';
import { insertPaper, getOrCreateTag, setPaperAuthors } from '../services/database.js';
import { parseNote, createNoteFromTemplate } from '../services/noteParser.js';
import { slugify } from '../utils/slugify.js';

function isPathInVault(filePath: string, vaultPath: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedVault = path.resolve(vaultPath);
  return resolved.startsWith(resolvedVault + path.sep) || resolved === resolvedVault;
}

function uniqueFilePath(dir: string, slug: string, ext: string): string {
  let filePath = path.join(dir, `${slug}${ext}`);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${slug}-${counter++}${ext}`);
  }
  return filePath;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

function buildTree(dirPath: string, rootPath: string): FileTreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  // Folders first
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  for (const folder of folders) {
    const fullPath = path.join(dirPath, folder.name);
    nodes.push({
      name: folder.name,
      path: fullPath,
      type: 'folder',
      children: buildTree(fullPath, rootPath),
    });
  }

  // Then files
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));
  for (const file of files) {
    nodes.push({
      name: file.name.replace(/\.md$/, ''),
      path: path.join(dirPath, file.name),
      type: 'file',
    });
  }

  return nodes;
}

export function registerFileIPC(getVaultPath: () => string, db: DatabaseType): void {
  // file:read
  ipcMain.handle('file:read', async (_event, filePath: string): Promise<string | { error: string }> => {
    try {
      const vaultPath = getVaultPath();
      if (!vaultPath) return { error: '仓库路径未配置' };
      if (!isPathInVault(filePath, vaultPath)) return { error: '访问被拒绝：路径在仓库外部' };
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : '读取文件失败' };
    }
  });

  // file:write
  ipcMain.handle('file:write', async (_event, filePath: string, content: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const vaultPath = getVaultPath();
      if (!vaultPath) return { success: false, error: '仓库路径未配置' };
      if (!isPathInVault(filePath, vaultPath)) return { success: false, error: '访问被拒绝：路径在仓库外部' };
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : '写入文件失败' };
    }
  });

  // file:list
  ipcMain.handle('file:list', async (_event, dirPath: string): Promise<string[]> => {
    try {
      const vaultPath = getVaultPath();
      if (!vaultPath || !isPathInVault(dirPath, vaultPath)) return [];
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
    } catch {
      return [];
    }
  });

  // file:listTree — recursive tree of folders and .md files under vault root
  ipcMain.handle('file:listTree', async (): Promise<FileTreeNode[]> => {
    const vaultPath = getVaultPath();
    if (!vaultPath) return [];
    await fs.promises.mkdir(path.join(vaultPath, 'papers'), { recursive: true });
    return buildTree(vaultPath, vaultPath).filter(
      (n) => n.name !== '.trash' && n.name !== '.backup' && n.name !== 'pdfs' && n.name !== 'templates' && n.name !== 'images' && n.name !== 'scholarnote.db' && n.name !== 'scholarnote.config.json',
    );
  });

  // folder:create — create a new subfolder under papers/
  ipcMain.handle(
    'folder:create',
    async (_event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        const papersDir = path.join(vaultPath, 'papers');
        const fullPath = path.resolve(papersDir, folderPath);
        if (!fullPath.startsWith(papersDir)) return { success: false, error: '访问被拒绝' };
        await fs.promises.mkdir(fullPath, { recursive: true });
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '创建文件夹失败' };
      }
    },
  );

  // folder:rename — rename a folder
  ipcMain.handle(
    'folder:rename',
    async (_event, oldPath: string, newName: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        if (!isPathInVault(oldPath, vaultPath)) return { success: false, error: '访问被拒绝' };
        const newPath = path.join(path.dirname(oldPath), newName);
        await fs.promises.rename(oldPath, newPath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '重命名失败' };
      }
    },
  );

  // folder:delete — delete an empty folder
  ipcMain.handle(
    'folder:delete',
    async (_event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        if (!isPathInVault(folderPath, vaultPath)) return { success: false, error: '访问被拒绝' };
        const papersDir = path.join(vaultPath, 'papers');
        if (folderPath === papersDir) return { success: false, error: '不能删除根目录' };
        // Only allow deleting empty folders
        const entries = await fs.promises.readdir(folderPath);
        if (entries.length > 0) return { success: false, error: '文件夹不为空，请先清空' };
        await fs.promises.rmdir(folderPath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '删除文件夹失败' };
      }
    },
  );

  // dialog:selectVault
  ipcMain.handle('dialog:selectVault', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择 ScholarNote 仓库',
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  // import:localMd — open file dialog for .md files, import each to vault
  ipcMain.handle(
    'import:localMd',
    async (
      event,
    ): Promise<{
      success: boolean;
      imported: Array<{ title: string; filePath: string }>;
      errors: string[];
    }> => {
      const result: {
        success: boolean;
        imported: Array<{ title: string; filePath: string }>;
        errors: string[];
      } = { success: true, imported: [], errors: [] };

      const vaultPath = getVaultPath();
      if (!vaultPath) {
        result.success = false;
        result.errors.push('仓库路径未配置');
        return result;
      }

      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        result.success = false;
        return result;
      }

      const dialogResult = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        title: '选择 Markdown 文件',
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) return result;

      const papersDir = path.join(vaultPath, 'papers');
      await fs.promises.mkdir(papersDir, { recursive: true });

      for (const srcPath of dialogResult.filePaths) {
        try {
          const content = await fs.promises.readFile(srcPath, 'utf-8');
          const { frontmatter } = parseNote(content);
          const title = frontmatter.title || path.basename(srcPath, path.extname(srcPath));
          const slug = slugify(title);
          const destPath = uniqueFilePath(papersDir, slug, '.md');

          await fs.promises.writeFile(destPath, content, 'utf-8');

          const paper = insertPaper(db, {
            title,
            slug,
            filePath: destPath,
            pdfPath: frontmatter.pdf_path ?? null,
            doi: frontmatter.doi ?? null,
            url: frontmatter.url ?? null,
            year: frontmatter.year ?? null,
            journal: frontmatter.journal ?? null,
            abstract: frontmatter.abstract ?? null,
            citations: frontmatter.citations ?? 0,
            readingStatus: frontmatter.reading_status ?? 'to-read',
            rating: frontmatter.rating ?? 0,
            bibtex: null, pinned: false,
            authors: [],
            tags: [],
          });

          if (frontmatter.authors && frontmatter.authors.length > 0) {
            setPaperAuthors(db, paper.id, frontmatter.authors);
          }
          if (frontmatter.tags && frontmatter.tags.length > 0) {
            for (const tagName of frontmatter.tags) {
              const tag = getOrCreateTag(db, tagName);
              db.prepare('INSERT OR IGNORE INTO paper_tags (paperId, tagId) VALUES (?, ?)').run(paper.id, tag.id);
            }
          }

          result.imported.push({ title, filePath: destPath });
        } catch (err: unknown) {
          result.errors.push(`${path.basename(srcPath)}: ${err instanceof Error ? err.message : '导入失败'}`);
        }
      }

      return result;
    },
  );

  // file:createNote — create a new blank note
  ipcMain.handle(
    'file:createNote',
    async (_event, title: string): Promise<{ success: boolean; notePath?: string; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        if (!title.trim()) return { success: false, error: '标题不能为空' };

        const slug = slugify(title);
        const papersDir = path.join(vaultPath, 'papers');
        await fs.promises.mkdir(papersDir, { recursive: true });

        const notePath = uniqueFilePath(papersDir, slug, '.md');
        const noteContent = createNoteFromTemplate({ title: title.trim(), tags: [], reading_status: 'to-read' });
        await fs.promises.writeFile(notePath, noteContent, 'utf-8');

        insertPaper(db, {
          title: title.trim(),
          slug,
          filePath: notePath,
          pdfPath: null,
          doi: null,
          url: null,
          year: null,
          journal: null,
          abstract: null,
          citations: 0,
          readingStatus: 'to-read',
          rating: 0,
          bibtex: null, pinned: false,
          authors: [],
          tags: [],
        });

        return { success: true, notePath };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '创建失败' };
      }
    },
  );

  // file:delete — move note to .trash directory
  ipcMain.handle(
    'file:delete',
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        if (!isPathInVault(filePath, vaultPath)) return { success: false, error: '访问被拒绝' };
        if (!filePath.endsWith('.md')) return { success: false, error: '只能删除 Markdown 文件' };

        const trashDir = path.join(vaultPath, '.trash');
        await fs.promises.mkdir(trashDir, { recursive: true });

        const baseName = path.basename(filePath);
        const timestamp = Date.now();
        const trashPath = path.join(trashDir, `${timestamp}-${baseName}`);
        await fs.promises.rename(filePath, trashPath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '删除失败' };
      }
    },
  );

  // trash:list — list files in trash
  ipcMain.handle('trash:list', async (): Promise<Array<{ name: string; originalName: string; path: string; deletedAt: number }>> => {
    try {
      const vaultPath = getVaultPath();
      const trashDir = path.join(vaultPath, '.trash');
      if (!fs.existsSync(trashDir)) return [];

      const entries = await fs.promises.readdir(trashDir);
      return entries
        .filter((e) => e.endsWith('.md'))
        .map((e) => {
          const match = e.match(/^(\d+)-(.+)$/);
          return {
            name: e,
            originalName: match ? match[2] : e,
            path: path.join(trashDir, e),
            deletedAt: match ? parseInt(match[1], 10) : 0,
          };
        })
        .sort((a, b) => b.deletedAt - a.deletedAt);
    } catch {
      return [];
    }
  });

  // trash:restore — restore a file from trash back to papers directory
  ipcMain.handle(
    'trash:restore',
    async (_event, trashItemPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        const trashDir = path.join(vaultPath, '.trash');
        if (!trashItemPath.startsWith(trashDir)) return { success: false, error: '访问被拒绝' };

        const match = path.basename(trashItemPath).match(/^\d+-(.+)$/);
        const originalName = match ? match[1] : path.basename(trashItemPath);
        const destPath = path.join(vaultPath, 'papers', originalName);

        // Ensure unique name
        let finalPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
          finalPath = path.join(vaultPath, 'papers', `${path.basename(originalName, '.md')}-${counter++}.md`);
        }

        await fs.promises.rename(trashItemPath, finalPath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '恢复失败' };
      }
    },
  );

  // trash:permanentDelete — permanently delete a file from trash
  ipcMain.handle(
    'trash:permanentDelete',
    async (_event, trashItemPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        const trashDir = path.join(vaultPath, '.trash');
        if (!trashItemPath.startsWith(trashDir)) return { success: false, error: '访问被拒绝' };
        await fs.promises.unlink(trashItemPath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '删除失败' };
      }
    },
  );

  // trash:empty — permanently delete all files in trash
  ipcMain.handle(
    'trash:empty',
    async (): Promise<{ success: boolean; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        const trashDir = path.join(vaultPath, '.trash');
        if (!fs.existsSync(trashDir)) return { success: true };
        const entries = await fs.promises.readdir(trashDir);
        for (const entry of entries) {
          await fs.promises.unlink(path.join(trashDir, entry));
        }
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '清空回收站失败' };
      }
    },
  );

  // file:showInExplorer — reveal file in system file manager
  ipcMain.handle(
    'file:showInExplorer',
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await shell.showItemInFolder(filePath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '操作失败' };
      }
    },
  );

  // image:save — save a base64-encoded image to vault/images/
  ipcMain.handle(
    'image:save',
    async (_event, base64Data: string, ext: string): Promise<{ success: boolean; path?: string; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) return { success: false, error: '仓库路径未配置' };
        const imagesDir = path.join(vaultPath, 'images');
        await fs.promises.mkdir(imagesDir, { recursive: true });

        const filename = `img-${Date.now()}.${ext || 'png'}`;
        const filePath = path.join(imagesDir, filename);
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(filePath, buffer);

        const relativePath = path.relative(vaultPath, filePath).replace(/\\/g, '/');
        return { success: true, path: relativePath };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '保存图片失败' };
      }
    },
  );

  // import:dropFiles — import .md files dropped onto the window
  ipcMain.handle(
    'import:dropFiles',
    async (_event, filePaths: string[]): Promise<{ success: boolean; imported: number; errors: string[] }> => {
      const result = { success: true, imported: 0, errors: [] as string[] };
      const vaultPath = getVaultPath();
      if (!vaultPath) { result.success = false; result.errors.push('仓库路径未配置'); return result; }

      const papersDir = path.join(vaultPath, 'papers');
      await fs.promises.mkdir(papersDir, { recursive: true });

      for (const srcPath of filePaths) {
        if (!srcPath.endsWith('.md') && !srcPath.endsWith('.markdown') && !srcPath.endsWith('.txt')) continue;
        try {
          const content = await fs.promises.readFile(srcPath, 'utf-8');
          const { frontmatter } = parseNote(content);
          const title = frontmatter.title || path.basename(srcPath, path.extname(srcPath));
          const slug = slugify(title);
          const destPath = uniqueFilePath(papersDir, slug, '.md');

          await fs.promises.writeFile(destPath, content, 'utf-8');

          const paper = insertPaper(db, {
            title, slug, filePath: destPath,
            pdfPath: frontmatter.pdf_path ?? null, doi: frontmatter.doi ?? null,
            url: frontmatter.url ?? null, year: frontmatter.year ?? null,
            journal: frontmatter.journal ?? null, abstract: frontmatter.abstract ?? null,
            citations: frontmatter.citations ?? 0,
            readingStatus: frontmatter.reading_status ?? 'to-read',
            rating: frontmatter.rating ?? 0, bibtex: null, pinned: false, authors: [], tags: [],
          });

          if (frontmatter.authors && frontmatter.authors.length > 0) {
            setPaperAuthors(db, paper.id, frontmatter.authors);
          }
          if (frontmatter.tags && frontmatter.tags.length > 0) {
            for (const tagName of frontmatter.tags) {
              const tag = getOrCreateTag(db, tagName);
              db.prepare('INSERT OR IGNORE INTO paper_tags (paperId, tagId) VALUES (?, ?)').run(paper.id, tag.id);
            }
          }
          result.imported++;
        } catch (err: unknown) {
          result.errors.push(`${path.basename(srcPath)}: ${err instanceof Error ? err.message : '导入失败'}`);
        }
      }
      return result;
    },
  );
}
