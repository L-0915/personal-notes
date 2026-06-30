import fs from 'node:fs';
import path from 'node:path';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Paper } from '../../src/types/index.js';
import { getAllPapers } from './database.js';

export interface LinkGraphNode { id: number; title: string; filePath: string; }
export interface LinkGraphEdge { source: string; target: string; }
export interface LinkGraph { nodes: LinkGraphNode[]; links: LinkGraphEdge[]; }
export interface BacklinkResult { title: string; abstract: string | null; year: number | null; filePath: string; }

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function analyzeAllNotes(vaultPath: string, db: DatabaseType): {
  backlinksMap: Map<string, BacklinkResult[]>;
  graph: LinkGraph;
} {
  const papers = getAllPapers(db);

  const titleToPaper = new Map<string, Paper>();
  for (const paper of papers) {
    titleToPaper.set(paper.title.toLowerCase(), paper);
  }

  const backlinksMap = new Map<string, BacklinkResult[]>();
  const linkSet = new Set<string>();

  for (const source of papers) {
    const filePath = path.join(vaultPath, source.filePath);

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const matches = content.matchAll(WIKI_LINK_RE);
    for (const match of matches) {
      const targetTitle = match[1].trim();
      if (!targetTitle) continue;

      const targetPaper = titleToPaper.get(targetTitle.toLowerCase());
      if (!targetPaper) continue;

      linkSet.add(`${source.title}->${targetPaper.title}`);

      const backlink: BacklinkResult = {
        title: source.title,
        abstract: source.abstract,
        year: source.year,
        filePath: source.filePath,
      };

      const existing = backlinksMap.get(targetPaper.title);
      if (existing) {
        if (!existing.some(b => b.title === source.title)) {
          existing.push(backlink);
        }
      } else {
        backlinksMap.set(targetPaper.title, [backlink]);
      }
    }
  }

  const nodes: LinkGraphNode[] = papers.map(p => ({
    id: p.id,
    title: p.title,
    filePath: p.filePath,
  }));

  const links: LinkGraphEdge[] = [];
  for (const key of linkSet) {
    const [source, target] = key.split('->');
    links.push({ source, target });
  }

  return { backlinksMap, graph: { nodes, links } };
}
