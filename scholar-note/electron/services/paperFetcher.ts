// electron/services/paperFetcher.ts
// Academic paper metadata fetcher — arXiv, CrossRef, Semantic Scholar

import type { NoteFrontmatter } from '../../src/types/index.js';

type SourceType = 'arxiv' | 'doi' | 'semantic_scholar' | 'pubmed' | null;

interface FetchResult {
  frontmatter: Partial<NoteFrontmatter>;
  pdfUrl: string | null;
}

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

export function detectSourceType(input: string): SourceType {
  const trimmed = input.trim();

  if (/^10\.\d{4,}\//.test(trimmed) || /^doi:/i.test(trimmed)) {
    return 'doi';
  }
  if (/arxiv\.org/i.test(trimmed) || /^\d{4}\.\d{4,}/.test(trimmed) || /^arxiv:/i.test(trimmed)) {
    return 'arxiv';
  }
  if (/semanticscholar\.org/i.test(trimmed)) {
    return 'semantic_scholar';
  }
  if (/pubmed/i.test(trimmed) || /^\d{7,}$/.test(trimmed)) {
    return 'pubmed';
  }
  // Try DOI embedded in a URL
  if (/^https?:\/\/doi\.org\//i.test(trimmed)) {
    return 'doi';
  }
  return null;
}

// ---------------------------------------------------------------------------
// arXiv helpers
// ---------------------------------------------------------------------------

export function extractArxivId(input: string): string {
  // Remove arxiv: prefix
  let cleaned = input.replace(/^arxiv:/i, '').trim();

  // Extract from URL patterns
  const urlMatch = cleaned.match(/arxiv\.org\/(?:abs|pdf|html)\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/i);
  if (urlMatch) return urlMatch[1];

  // Old-style IDs: hep-th/9901001
  const oldMatch = cleaned.match(/([a-z-]+\/\d{7})/i);
  if (oldMatch) return oldMatch[1];

  // Bare ID: 2301.01234 or 2301.01234v2
  const bareMatch = cleaned.match(/(\d{4}\.\d{4,}(?:v\d+)?)/);
  if (bareMatch) return bareMatch[1];

  return cleaned;
}

async function fetchFromArxiv(arxivId: string): Promise<FetchResult> {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`arXiv API returned status ${response.status}`);
  }

  const xml = await response.text();

  // Simple XML parsing for Atom feed
  const titleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  // Skip the feed-level title, look for entry-level
  const entries = xml.split(/<entry>/);
  if (entries.length < 2) {
    throw new Error('No arXiv entry found for the given ID');
  }

  const entry = entries[1];
  const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ') ?? '';
  const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ') ?? '';

  const authorMatches = [...entry.matchAll(/<name>(.*?)<\/name>/g)];
  const authors = authorMatches.map((m) => m[1].trim());

  const doiMatch = entry.match(/<doi[^>]*>(.*?)<\/doi>/);
  const doi = doiMatch?.[1]?.trim() ?? null;

  const pdfLinkMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
  const pdfUrl = pdfLinkMatch?.[1] ?? null;

  const publishedMatch = entry.match(/<published>(\d{4})/);
  const year = publishedMatch ? parseInt(publishedMatch[1], 10) : undefined;

  return {
    frontmatter: {
      title,
      authors,
      year,
      abstract: summary || undefined,
      doi: doi ?? undefined,
      url: `https://arxiv.org/abs/${arxivId}`,
      pdf_path: pdfUrl ?? undefined,
      reading_status: 'to-read',
      added_date: new Date().toISOString().split('T')[0],
    },
    pdfUrl,
  };
}

// ---------------------------------------------------------------------------
// CrossRef (DOI) fetcher
// ---------------------------------------------------------------------------

async function fetchFromCrossRef(doi: string): Promise<FetchResult> {
  const cleanedDoi = doi.replace(/^doi:/i, '').replace(/^https?:\/\/doi\.org\//i, '').trim();

  const url = `https://api.crossref.org/works/${encodeURIComponent(cleanedDoi)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ScholarNote/0.1.0 (mailto:scholarnote@example.com)' },
  });

  if (!response.ok) {
    throw new Error(`CrossRef API returned status ${response.status}`);
  }

  const data = await response.json();
  const item = data.message;

  const title = (item.title as string[] | undefined)?.[0] ?? '';
  const authors = (item.author as Array<{ given?: string; family?: string }> | undefined)?.map(
    (a) => [a.given, a.family].filter(Boolean).join(' '),
  ) ?? [];
  const year = item.published?.['date-parts']?.[0]?.[0] as number | undefined;
  const journal = (item['container-title'] as string[] | undefined)?.[0] ?? undefined;
  const abstract = (item.abstract as string | undefined)?.replace(/<[^>]+>/g, '') ?? undefined;

  // Try to find a PDF link
  const links = item.link as Array<{ 'content-type'?: string; URL?: string }> | undefined;
  const pdfLink = links?.find((l) => l['content-type'] === 'application/pdf');

  return {
    frontmatter: {
      title,
      authors,
      year,
      journal,
      abstract,
      doi: cleanedDoi,
      url: `https://doi.org/${cleanedDoi}`,
      pdf_path: pdfLink?.URL ?? undefined,
      reading_status: 'to-read',
      added_date: new Date().toISOString().split('T')[0],
    },
    pdfUrl: pdfLink?.URL ?? null,
  };
}

// ---------------------------------------------------------------------------
// Semantic Scholar fetcher
// ---------------------------------------------------------------------------

async function fetchFromSemanticScholar(input: string): Promise<FetchResult> {
  // Extract paper ID from URL or use as-is
  let paperId = input.trim();
  const urlMatch = paperId.match(/semanticscholar\.org\/paper\/([^/?#]+)/);
  if (urlMatch) {
    paperId = urlMatch[1];
  }

  const fields = 'title,authors,year,abstract,citationCount,externalIds,journal';
  const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}?fields=${fields}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Semantic Scholar API returned status ${response.status}`);
  }

  const data = await response.json();

  const title = (data.title as string) ?? '';
  const authors = (data.authors as Array<{ name: string }>)?.map((a) => a.name) ?? [];
  const year = data.year as number | undefined;
  const abstract = (data.abstract as string) ?? undefined;
  const citations = (data.citationCount as number) ?? 0;
  const journal = (data.journal as { name?: string })?.name ?? undefined;
  const externalIds = data.externalIds as Record<string, string> | undefined;
  const doi = externalIds?.DOI ?? undefined;
  const arxivId = externalIds?.ArXiv ?? undefined;

  // Prefer arXiv PDF link if available
  const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;

  return {
    frontmatter: {
      title,
      authors,
      year,
      abstract,
      doi,
      journal,
      citations,
      url: arxivId ? `https://arxiv.org/abs/${arxivId}` : (doi ? `https://doi.org/${doi}` : undefined),
      pdf_path: pdfUrl ?? undefined,
      reading_status: 'to-read',
      added_date: new Date().toISOString().split('T')[0],
    },
    pdfUrl,
  };
}

// ---------------------------------------------------------------------------
// Main fetch dispatcher
// ---------------------------------------------------------------------------

export async function fetchPaperMeta(input: string): Promise<FetchResult> {
  const source = detectSourceType(input);

  try {
    switch (source) {
      case 'arxiv': {
        const arxivId = extractArxivId(input);
        return await fetchFromArxiv(arxivId);
      }
      case 'doi':
        return await fetchFromCrossRef(input);
      case 'semantic_scholar':
        return await fetchFromSemanticScholar(input);
      default:
        throw new Error(
          'Unrecognised source. Please provide an arXiv URL/ID, a DOI, or a Semantic Scholar URL.',
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown fetch error';
    throw new Error(`Failed to fetch paper metadata: ${message}`);
  }
}
