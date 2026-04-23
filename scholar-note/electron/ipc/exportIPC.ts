// electron/ipc/exportIPC.ts
// Export IPC handlers — save exported files to disk

import fs from 'node:fs';
import path from 'node:path';
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { exportToPdf, exportToHtml, exportToDocx, exportToMarkdown } from '../services/exportService.js';

type ExportFormat = 'pdf' | 'docx' | 'html' | 'md';

const FILTERS: Record<ExportFormat, Electron.FileFilter[]> = {
  pdf: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  docx: [{ name: 'Word 文档', extensions: ['docx'] }],
  html: [{ name: 'HTML 文件', extensions: ['html'] }],
  md: [{ name: 'Markdown 文件', extensions: ['md'] }],
};

const EXT_MAP: Record<ExportFormat, string> = {
  pdf: '.pdf',
  docx: '.docx',
  html: '.html',
  md: '.md',
};

export function registerExportIPC(): void {
  ipcMain.handle(
    'export:note',
    async (
      event,
      format: ExportFormat,
      markdown: string,
      title: string,
    ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { success: false, error: '无法获取窗口' };

        const safeName = title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '未命名笔记';
        const defaultName = `${safeName}${EXT_MAP[format]}`;

        const result = await dialog.showSaveDialog(win, {
          title: '导出笔记',
          defaultPath: defaultName,
          filters: FILTERS[format],
        });

        if (result.canceled || !result.filePath) {
          return { success: false };
        }

        const destPath = result.filePath;

        switch (format) {
          case 'pdf': {
            const htmlContent = exportToHtml(markdown, title);
            const pdfBuffer = await exportToPdf(htmlContent);
            fs.writeFileSync(destPath, pdfBuffer);
            break;
          }
          case 'docx': {
            const docxBuffer = await exportToDocx(markdown, title);
            fs.writeFileSync(destPath, docxBuffer);
            break;
          }
          case 'html': {
            const htmlContent = exportToHtml(markdown, title);
            fs.writeFileSync(destPath, htmlContent, 'utf-8');
            break;
          }
          case 'md': {
            const mdContent = exportToMarkdown(markdown);
            fs.writeFileSync(destPath, mdContent, 'utf-8');
            break;
          }
          default:
            return { success: false, error: `不支持的格式: ${format}` };
        }

        return { success: true, filePath: destPath };
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : '导出失败' };
      }
    },
  );
}
