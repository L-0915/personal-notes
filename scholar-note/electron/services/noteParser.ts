// electron/services/noteParser.ts
import matter from 'gray-matter';
import type { NoteContent, NoteFrontmatter, ReadingStatus } from '../../src/types/index.js';

/* ------------------------------------------------------------------ */
/*  Parse                                                              */
/* ------------------------------------------------------------------ */

export function parseNote(markdown: string): NoteContent {
  const { data, content } = matter(markdown);
  const frontmatter: NoteFrontmatter = {
    title: String(data.title ?? ''),
    authors: Array.isArray(data.authors) ? data.authors.map(String) : undefined,
    year: typeof data.year === 'number' ? data.year : undefined,
    journal: typeof data.journal === 'string' ? data.journal : undefined,
    doi: typeof data.doi === 'string' ? data.doi : undefined,
    url: typeof data.url === 'string' ? data.url : undefined,
    pdf_path: typeof data.pdf_path === 'string' ? data.pdf_path : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    reading_status: validateReadingStatus(data.reading_status),
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    citations: typeof data.citations === 'number' ? data.citations : undefined,
    added_date: typeof data.added_date === 'string' ? data.added_date : undefined,
  };
  return { frontmatter, body: content };
}

/* ------------------------------------------------------------------ */
/*  Serialize                                                          */
/* ------------------------------------------------------------------ */

export function serializeNote(frontmatter: NoteFrontmatter, body: string): string {
  const clean = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined),
  );
  return matter.stringify(body, clean);
}

/* ------------------------------------------------------------------ */
/*  Template                                                           */
/* ------------------------------------------------------------------ */

interface TemplateMeta {
  title: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  url?: string;
  pdf_path?: string;
  tags?: string[];
  reading_status?: ReadingStatus;
}

export function createNoteFromTemplate(meta: TemplateMeta): string {
  const frontmatter: NoteFrontmatter = {
    title: meta.title,
    authors: meta.authors ?? [],
    year: meta.year,
    journal: meta.journal,
    doi: meta.doi,
    url: meta.url,
    pdf_path: meta.pdf_path,
    tags: meta.tags ?? [],
    reading_status: meta.reading_status ?? 'to-read',
    rating: 0,
    citations: 0,
    added_date: new Date().toISOString(),
  };

  const body = [
    '## 摘要',
    '',
    '',
    '## 主要贡献',
    '',
    '- ',
    '',
    '## 方法',
    '',
    '',
    '## 个人笔记',
    '',
    '',
    '## 相关论文',
    '',
    `<!-- 粘贴本地论文路径，如：[论文标题](D:\\path\\to\\paper.pdf) -->`,
    '',
  ].join('\n');

  return serializeNote(frontmatter, body);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

const VALID_STATUSES: ReadonlySet<string> = new Set(['to-read', 'reading', 'read']);

function validateReadingStatus(value: unknown): ReadingStatus | undefined {
  if (typeof value === 'string' && VALID_STATUSES.has(value)) {
    return value as ReadingStatus;
  }
  return undefined;
}
