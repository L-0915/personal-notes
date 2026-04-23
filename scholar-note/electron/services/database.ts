// electron/services/database.ts
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Paper, Author, Tag, ReadingStatus } from '../../src/types/index.js';

export type { DatabaseType };

/* ------------------------------------------------------------------ */
/*  Schema migration                                                   */
/* ------------------------------------------------------------------ */

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS papers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  slug          TEXT    NOT NULL UNIQUE,
  filePath      TEXT    NOT NULL UNIQUE,
  pdfPath       TEXT,
  doi           TEXT,
  url           TEXT,
  year          INTEGER,
  journal       TEXT,
  abstract      TEXT,
  citations     INTEGER NOT NULL DEFAULT 0,
  readingStatus TEXT    NOT NULL DEFAULT 'to-read'
                  CHECK (readingStatus IN ('to-read','reading','read')),
  rating        INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  addedDate     TEXT    NOT NULL DEFAULT (datetime('now')),
  updatedDate   TEXT    NOT NULL DEFAULT (datetime('now')),
  bibtex        TEXT,
  pinned        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS authors (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS paper_authors (
  paperId  INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  authorId INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  "order"  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (paperId, authorId)
);

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS paper_tags (
  paperId INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  tagId   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paperId, tagId)
);

CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts
  USING fts5(title, abstract, bibtex, content=papers, content_rowid=id);

CREATE TRIGGER IF NOT EXISTS papers_ai AFTER INSERT ON papers BEGIN
  INSERT INTO papers_fts(rowid, title, abstract, bibtex) VALUES (new.id, new.title, new.abstract, new.bibtex);
END;
CREATE TRIGGER IF NOT EXISTS papers_ad AFTER DELETE ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, abstract, bibtex) VALUES ('delete', old.id, old.title, old.abstract, old.bibtex);
END;
CREATE TRIGGER IF NOT EXISTS papers_au AFTER UPDATE ON papers BEGIN
  INSERT INTO papers_fts(papers_fts, rowid, title, abstract, bibtex) VALUES ('delete', old.id, old.title, old.abstract, old.bibtex);
  INSERT INTO papers_fts(rowid, title, abstract, bibtex) VALUES (new.id, new.title, new.abstract, new.bibtex);
END;
`;

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

export function initDatabase(dbPath: string): DatabaseType {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATIONS);
  // Add pinned column if upgrading from an older schema
  const cols = db.prepare("PRAGMA table_info(papers)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'pinned')) {
    db.exec('ALTER TABLE papers ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  }
  return db;
}

/* ------------------------------------------------------------------ */
/*  Paper CRUD                                                         */
/* ------------------------------------------------------------------ */

interface PaperRow {
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
  pinned: number;
}

function hydratePaper(row: PaperRow, authors: Author[], tags: Tag[]): Paper {
  return { ...row, pinned: !!row.pinned, authors, tags };
}

export function insertPaper(
  db: DatabaseType,
  paper: Omit<Paper, 'id' | 'addedDate' | 'updatedDate'>,
): Paper {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO papers
       (title, slug, filePath, pdfPath, doi, url, year, journal,
        abstract, citations, readingStatus, rating, addedDate, updatedDate, bibtex)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    paper.title, paper.slug, paper.filePath, paper.pdfPath,
    paper.doi, paper.url, paper.year, paper.journal,
    paper.abstract, paper.citations, paper.readingStatus,
    paper.rating, now, now, paper.bibtex,
  );
  const id = Number(info.lastInsertRowid);
  return { ...paper, id, addedDate: now, updatedDate: now };
}

export function getPaper(db: DatabaseType, id: number): Paper | undefined {
  const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as PaperRow | undefined;
  if (!row) return undefined;
  return hydratePaper(row, getAuthorsForPaper(db, id), getTagsForPaper(db, id));
}

export function getAllPapers(db: DatabaseType): Paper[] {
  const rows = db.prepare('SELECT * FROM papers ORDER BY addedDate DESC').all() as PaperRow[];
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const authorRows = db.prepare(
    `SELECT pa.paperId, pa."order" as position, a.id as authorId, a.name
     FROM paper_authors pa JOIN authors a ON pa.authorId = a.id
     WHERE pa.paperId IN (${placeholders}) ORDER BY pa."order"`,
  ).all(...ids) as Array<{ paperId: number; authorId: number; name: string }>;

  const tagRows = db.prepare(
    `SELECT pt.paperId, t.id as tagId, t.name, t.color
     FROM paper_tags pt JOIN tags t ON pt.tagId = t.id
     WHERE pt.paperId IN (${placeholders})`,
  ).all(...ids) as Array<{ paperId: number; tagId: number; name: string; color: string }>;

  const authorsByPaper = new Map<number, Author[]>();
  for (const row of authorRows) {
    const list = authorsByPaper.get(row.paperId) || [];
    list.push({ id: row.authorId, name: row.name });
    authorsByPaper.set(row.paperId, list);
  }

  const tagsByPaper = new Map<number, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByPaper.get(row.paperId) || [];
    list.push({ id: row.tagId, name: row.name, color: row.color });
    tagsByPaper.set(row.paperId, list);
  }

  return rows.map(row =>
    hydratePaper(row, authorsByPaper.get(row.id) || [], tagsByPaper.get(row.id) || []),
  );
}

export function updatePaper(db: DatabaseType, id: number, patch: Partial<Paper>): boolean {
  const allowed = [
    'title', 'slug', 'filePath', 'pdfPath', 'doi', 'url',
    'year', 'journal', 'abstract', 'citations', 'readingStatus',
    'rating', 'bibtex', 'pinned',
  ] as const;
  const entries = Object.entries(patch).filter(
    ([k]) => allowed.includes(k as (typeof allowed)[number]),
  );
  if (entries.length === 0) return false;

  const sets = entries.map(([k]) => `${k} = ?`).concat("updatedDate = datetime('now')").join(', ');
  const values = entries.map(([, v]) => v);
  const result = db.prepare(`UPDATE papers SET ${sets} WHERE id = ?`).run(...values, id);
  return result.changes > 0;
}

export function deletePaper(db: DatabaseType, id: number): boolean {
  const result = db.prepare('DELETE FROM papers WHERE id = ?').run(id);
  return result.changes > 0;
}

/* ------------------------------------------------------------------ */
/*  Tag helpers                                                        */
/* ------------------------------------------------------------------ */

export function getOrCreateTag(db: DatabaseType, name: string, color = '#6b7280'): Tag {
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag | undefined;
  if (existing) return existing;
  const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
  return { id: Number(info.lastInsertRowid), name, color };
}

export function getTags(db: DatabaseType): Tag[] {
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}

export function getPapersByTag(db: DatabaseType, tagId: number): Paper[] {
  const rows = db.prepare(
    `SELECT p.* FROM papers p
       JOIN paper_tags pt ON pt.paperId = p.id
     WHERE pt.tagId = ?
     ORDER BY p.addedDate DESC`,
  ).all(tagId) as PaperRow[];
  return rows.map((row) =>
    hydratePaper(row, getAuthorsForPaper(db, row.id), getTagsForPaper(db, row.id)),
  );
}

export function getPapersByStatus(db: DatabaseType, status: string): Paper[] {
  const rows = db.prepare(
    `SELECT * FROM papers WHERE readingStatus = ? ORDER BY addedDate DESC`,
  ).all(status) as PaperRow[];
  return rows.map((row) =>
    hydratePaper(row, getAuthorsForPaper(db, row.id), getTagsForPaper(db, row.id)),
  );
}

/* ------------------------------------------------------------------ */
/*  Author helpers                                                     */
/* ------------------------------------------------------------------ */

export function getOrCreateAuthor(db: DatabaseType, name: string): Author {
  const existing = db.prepare('SELECT * FROM authors WHERE name = ?').get(name) as Author | undefined;
  if (existing) return existing;
  const info = db.prepare('INSERT INTO authors (name) VALUES (?)').run(name);
  return { id: Number(info.lastInsertRowid), name };
}

export function setPaperAuthors(db: DatabaseType, paperId: number, authorNames: string[]): void {
  const del = db.prepare('DELETE FROM paper_authors WHERE paperId = ?');
  const ins = db.prepare('INSERT INTO paper_authors (paperId, authorId, "order") VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    del.run(paperId);
    authorNames.forEach((name, idx) => {
      const author = getOrCreateAuthor(db, name);
      ins.run(paperId, author.id, idx);
    });
  });
  tx();
}

/* ------------------------------------------------------------------ */
/*  Internal join helpers                                              */
/* ------------------------------------------------------------------ */

function getAuthorsForPaper(db: DatabaseType, paperId: number): Author[] {
  return db.prepare(
    `SELECT a.* FROM authors a
       JOIN paper_authors pa ON pa.authorId = a.id
     WHERE pa.paperId = ?
     ORDER BY pa."order"`,
  ).all(paperId) as Author[];
}

function getTagsForPaper(db: DatabaseType, paperId: number): Tag[] {
  return db.prepare(
    `SELECT t.* FROM tags t
       JOIN paper_tags pt ON pt.tagId = t.id
     WHERE pt.paperId = ?
     ORDER BY t.name`,
  ).all(paperId) as Tag[];
}
