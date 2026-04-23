// src/types/index.ts

export interface Paper {
  id: number;
  title: string;
  slug: string;
  filePath: string;
  pdfPath: string | null;
  doi: string | null;
  url: string | null;
  year: number | null;
  journal: string | null;
  abstract: string | null;
  citations: number;
  readingStatus: ReadingStatus;
  rating: number;
  addedDate: string;
  updatedDate: string;
  bibtex: string | null;
  pinned: boolean;
  authors: Author[];
  tags: Tag[];
}

export interface Author {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export type ReadingStatus = 'to-read' | 'reading' | 'read';

export interface NoteContent {
  frontmatter: NoteFrontmatter;
  body: string;
}

export interface NoteFrontmatter {
  title: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  url?: string;
  pdf_path?: string;
  tags?: string[];
  reading_status?: ReadingStatus;
  rating?: number;
  citations?: number;
  abstract?: string;
  added_date?: string;
}

export interface SearchResult {
  id: number;
  title: string;
  slug: string;
  filePath: string;
  snippet: string;
  rank: number;
}

export interface ImportResult {
  success: boolean;
  paper?: Paper;
  error?: string;
}

export interface VaultConfig {
  vaultPath: string;
  papersDir: string;
  templatesDir: string;
  imagesDir: string;
}
