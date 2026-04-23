// electron/services/searchEngine.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import type { SearchResult } from '../../src/types/index.js';

/* ------------------------------------------------------------------ */
/*  Full-text search                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search papers using the FTS5 virtual table.
 *
 * Returns results ordered by relevance with a highlighted snippet
 * generated from the matching text.
 */
export function searchPapers(db: DatabaseType, query: string): SearchResult[] {
  const safeQuery = sanitizeFTSQuery(query);
  if (safeQuery.length === 0) return [];

  const rows = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.filePath,
      snippet(papers_fts, 0, '<<', '>>', '...', 30) AS snippet,
      f.rank
    FROM papers_fts f
    JOIN papers p ON p.id = f.rowid
    WHERE papers_fts MATCH ?
    ORDER BY f.rank
  `).all(safeQuery) as Array<{
    id: number;
    title: string;
    slug: string;
    filePath: string;
    snippet: string;
    rank: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    filePath: row.filePath,
    snippet: row.snippet,
    rank: row.rank,
  }));
}

/* ------------------------------------------------------------------ */
/*  Re-index                                                           */
/* ------------------------------------------------------------------ */

/**
 * Rebuild the FTS5 index from the papers table.
 * Call this after bulk inserts or if the index becomes corrupted.
 */
export function reindexFTS(db: DatabaseType): void {
  db.exec(`
    INSERT INTO papers_fts(papers_fts)
    VALUES ('rebuild');
  `);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sanitize a raw user query for safe use in an FTS5 MATCH expression.
 *
 * - Strips characters that have special meaning in FTS5 syntax
 * - Wraps each term with the * wildcard for prefix matching
 * - Returns empty string for unsafe / empty input
 */
function sanitizeFTSQuery(raw: string): string {
  const cleaned = raw
    .replace(/["*^()+|~{}:]/g, ' ')   // remove FTS5 special chars
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) return '';

  // Split into individual words and add prefix wildcards
  const terms = cleaned
    .split(' ')
    .filter((t) => t.length > 0)
    .map((t) => `${t}*`);

  return terms.join(' ');
}
