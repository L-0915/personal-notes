// electron/ipc/paperIPC.ts
// Paper import and PDF IPC handlers

import fs from 'node:fs';
import path from 'node:path';
import { ipcMain, shell } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';
import { fetchPaperMeta, extractArxivId, detectSourceType } from '../services/paperFetcher.js';
import { downloadPdf, getPdfFilename } from '../services/pdfManager.js';
import { createNoteFromTemplate } from '../services/noteParser.js';
import { slugify } from '../utils/slugify.js';
import { insertPaper, getOrCreateTag, setPaperAuthors } from '../services/database.js';

function uniqueFilePath(dir: string, slug: string, ext: string): string {
  let filePath = path.join(dir, `${slug}${ext}`);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${slug}-${counter++}${ext}`);
  }
  return filePath;
}

export function registerPaperIPC(getVaultPath: () => string, db: DatabaseType): void {
  // paper:import — fetch metadata, download PDF, create note file, insert into database
  ipcMain.handle(
    'paper:import',
    async (
      _event,
      urlOrDoi: string,
    ): Promise<{ success: boolean; notePath?: string; error?: string }> => {
      try {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
          return { success: false, error: '仓库路径未配置' };
        }

        const { frontmatter, pdfUrl } = await fetchPaperMeta(urlOrDoi);

        let localPdfPath: string | undefined;
        if (pdfUrl) {
          const arxivId = detectSourceType(urlOrDoi) === 'arxiv' ? extractArxivId(urlOrDoi) : undefined;
          const pdfFilename = getPdfFilename(arxivId, frontmatter.title);
          const pdfDir = path.join(vaultPath, 'pdfs');
          const absolutePdfPath = await downloadPdf(pdfUrl, pdfDir, pdfFilename);
          localPdfPath = path.relative(vaultPath, absolutePdfPath).replace(/\\/g, '/');
        }

        const noteContent = createNoteFromTemplate({
          title: frontmatter.title ?? '未命名论文',
          authors: frontmatter.authors,
          year: frontmatter.year,
          journal: frontmatter.journal,
          doi: frontmatter.doi,
          url: frontmatter.url,
          pdf_path: localPdfPath ?? frontmatter.pdf_path,
          tags: frontmatter.tags,
          reading_status: frontmatter.reading_status,
        });

        const rawTitle = frontmatter.title ?? 'untitled';
        const slug = slugify(rawTitle);
        const papersDir = path.join(vaultPath, 'papers');
        await fs.promises.mkdir(papersDir, { recursive: true });

        const notePath = uniqueFilePath(papersDir, slug, '.md');
        await fs.promises.writeFile(notePath, noteContent, 'utf-8');

        // Insert into database
        const paper = insertPaper(db, {
          title: rawTitle,
          slug,
          filePath: notePath,
          pdfPath: localPdfPath ?? frontmatter.pdf_path ?? null,
          doi: frontmatter.doi ?? null,
          url: frontmatter.url ?? null,
          year: frontmatter.year ?? null,
          journal: frontmatter.journal ?? null,
          abstract: frontmatter.abstract ?? null,
          citations: frontmatter.citations ?? 0,
          readingStatus: frontmatter.reading_status ?? 'to-read',
          rating: frontmatter.rating ?? 0,
          bibtex: null,
          pinned: false,
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

        return { success: true, notePath };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '导入失败';
        return { success: false, error: message };
      }
    },
  );

  // file:openLocal — open any local file with the system default application
  ipcMain.handle(
    'file:openLocal',
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: '无效的文件路径' };
        }

        let absolutePath: string;
        if (path.isAbsolute(filePath)) {
          absolutePath = path.resolve(filePath);
        } else {
          const vaultPath = getVaultPath();
          absolutePath = path.resolve(vaultPath, filePath);
        }

        if (!fs.existsSync(absolutePath)) {
          return { success: false, error: '文件不存在: ' + absolutePath };
        }

        await shell.openPath(absolutePath);
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '打开文件失败' };
      }
    },
  );
}
