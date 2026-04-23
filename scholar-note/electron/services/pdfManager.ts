// electron/services/pdfManager.ts
// PDF download and storage management

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

/**
 * Generate a safe PDF filename from an arXiv ID or paper title.
 * Falls back to a timestamp-based name when neither is available.
 */
export function getPdfFilename(arxivId?: string, title?: string): string {
  if (arxivId) {
    const safeId = arxivId.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${safeId}.pdf`;
  }

  if (title) {
    const safeName = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return `${safeName}.pdf`;
  }

  return `paper-${Date.now()}.pdf`;
}

// ---------------------------------------------------------------------------
// PDF download
// ---------------------------------------------------------------------------

/**
 * Download a PDF from `url` into `targetDir/filename`.
 * Creates `targetDir` if it does not exist.
 * Returns the absolute path of the saved file.
 */
export async function downloadPdf(
  url: string,
  targetDir: string,
  filename: string,
): Promise<string> {
  // Ensure target directory exists
  await fs.promises.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, filename);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PDF download failed: HTTP ${response.status} for ${url}`);
  }

  if (!response.body) {
    throw new Error('PDF download failed: response body is null');
  }

  // response.body is a ReadableStream; convert to Node stream for pipeline
  const nodeReadable = response.body as unknown as NodeJS.ReadableStream;
  const writable = createWriteStream(filePath);

  await pipeline(nodeReadable, writable);

  // Verify the file actually landed
  const stats = await fs.promises.stat(filePath);
  if (stats.size === 0) {
    await fs.promises.unlink(filePath).catch(() => {});
    throw new Error('Downloaded PDF is empty');
  }

  return filePath;
}
