import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAllNotes } from '@electron/services/linkAnalyzer.js';
import type { LinkGraph, BacklinkResult } from '@electron/services/linkAnalyzer.js';
import type { Paper } from '@/types/index.js';

vi.mock('@electron/services/database.js', () => ({
  getAllPapers: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

import { getAllPapers } from '@electron/services/database.js';
import fs from 'node:fs';

function makePaper(overrides: Partial<Paper> & { id: number; title: string; filePath: string }): Paper {
  return {
    slug: `slug-${overrides.id}`,
    pdfPath: null,
    doi: null,
    url: null,
    year: null,
    journal: null,
    abstract: null,
    citations: 0,
    readingStatus: 'to-read' as const,
    rating: 0,
    addedDate: '2024-01-01',
    updatedDate: '2024-01-01',
    bibtex: null,
    pinned: false,
    authors: [],
    tags: [],
    ...overrides,
  };
}

describe('analyzeAllNotes', () => {
  const vaultPath = 'D:/test-vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空笔记列表 → 返回空的 backlinksMap 和空的 graph', () => {
    vi.mocked(getAllPapers).mockReturnValue([]);

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.backlinksMap.size).toBe(0);
    expect(result.graph.nodes).toHaveLength(0);
    expect(result.graph.links).toHaveLength(0);
  });

  it('一篇笔记没有 wiki-link → graph 只有 1 个 node，0 个 links', () => {
    const paperA = makePaper({ id: 1, title: '论文A', filePath: 'notes/paper-a.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA]);
    vi.mocked(fs.readFileSync).mockReturnValue('# 论文A\n\n这是一篇没有链接的笔记。');

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0]).toMatchObject({ id: 1, title: '论文A', filePath: 'notes/paper-a.md' });
    expect(result.graph.links).toHaveLength(0);
    expect(result.backlinksMap.size).toBe(0);
  });

  it('笔记 A 引用笔记 B（[[笔记B]]）→ graph 有 2 nodes + 1 edge；backlinksMap 包含 B 的引用', () => {
    const paperA = makePaper({ id: 1, title: '笔记A', filePath: 'notes/a.md' });
    const paperB = makePaper({ id: 2, title: '笔记B', filePath: 'notes/b.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA, paperB]);
    const readFileMock = vi.mocked(fs.readFileSync);
    readFileMock.mockImplementation((fp: string) => {
      if ((fp as string).endsWith('a.md')) return '# 笔记A\n\n参考 [[笔记B]] 的方法。';
      if ((fp as string).endsWith('b.md')) return '# 笔记B\n\n这是一篇独立笔记。';
      throw new Error(`Unexpected file: ${fp}`);
    });

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.graph.nodes).toHaveLength(2);
    expect(result.graph.links).toHaveLength(1);
    expect(result.graph.links[0]).toEqual({ source: '笔记A', target: '笔记B' });

    const bBacklinks = result.backlinksMap.get('笔记B');
    expect(bBacklinks).toBeDefined();
    expect(bBacklinks).toHaveLength(1);
    expect(bBacklinks![0]).toMatchObject({ title: '笔记A', filePath: 'notes/a.md' });
  });

  it('多篇笔记互相引用 → 正确构建图结构', () => {
    const paperA = makePaper({ id: 1, title: '论文A', filePath: 'notes/a.md' });
    const paperB = makePaper({ id: 2, title: '论文B', filePath: 'notes/b.md' });
    const paperC = makePaper({ id: 3, title: '论文C', filePath: 'notes/c.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA, paperB, paperC]);
    const readFileMock = vi.mocked(fs.readFileSync);
    readFileMock.mockImplementation((fp: string) => {
      if ((fp as string).endsWith('a.md')) return '# A\n\n参考 [[论文B]] 和 [[论文C]]';
      if ((fp as string).endsWith('b.md')) return '# B\n\n参考 [[论文C]]';
      if ((fp as string).endsWith('c.md')) return '# C\n\n无引用';
      throw new Error(`Unexpected file: ${fp}`);
    });

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.links).toHaveLength(3);
    expect(result.graph.links).toEqual(
      expect.arrayContaining([
        { source: '论文A', target: '论文B' },
        { source: '论文A', target: '论文C' },
        { source: '论文B', target: '论文C' },
      ]),
    );

    const cBacklinks = result.backlinksMap.get('论文C');
    expect(cBacklinks).toHaveLength(2);
    expect(cBacklinks!.map(b => b.title).sort()).toEqual(['论文A', '论文B']);

    const bBacklinks = result.backlinksMap.get('论文B');
    expect(bBacklinks).toHaveLength(1);
    expect(bBacklinks![0].title).toBe('论文A');
  });

  it('引用不存在的笔记标题 → 不创建 edge，不添加 backlink', () => {
    const paperA = makePaper({ id: 1, title: '笔记A', filePath: 'notes/a.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA]);
    vi.mocked(fs.readFileSync).mockReturnValue('# 笔记A\n\n参考 [[不存在的笔记]]');

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.links).toHaveLength(0);
    expect(result.backlinksMap.size).toBe(0);
  });

  it('重复的 wiki-link（同一篇笔记多次引用同一目标）→ 去重，backlink 只出现一次', () => {
    const paperA = makePaper({ id: 1, title: '笔记A', filePath: 'notes/a.md' });
    const paperB = makePaper({ id: 2, title: '笔记B', filePath: 'notes/b.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA, paperB]);
    vi.mocked(fs.readFileSync).mockImplementation((fp: string) => {
      if ((fp as string).endsWith('a.md')) return '# 笔记A\n\n[[笔记B]] 第一次引用，[[笔记B]] 第二次引用。';
      if ((fp as string).endsWith('b.md')) return '# 笔记B\n\n独立笔记';
      throw new Error(`Unexpected file: ${fp}`);
    });

    const result = analyzeAllNotes(vaultPath, {} as never);

    const bBacklinks = result.backlinksMap.get('笔记B');
    expect(bBacklinks).toHaveLength(1);
    expect(result.graph.links).toHaveLength(1);
  });

  it('大小写不敏感匹配：笔记 A 中 [[笔记b]] 匹配到标题为 "笔记B" 的笔记', () => {
    const paperA = makePaper({ id: 1, title: '笔记A', filePath: 'notes/a.md' });
    const paperB = makePaper({ id: 2, title: '笔记B', filePath: 'notes/b.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA, paperB]);
    const readFileMock = vi.mocked(fs.readFileSync);
    readFileMock.mockImplementation((fp: string) => {
      if ((fp as string).endsWith('a.md')) return '# 笔记A\n\n参考 [[笔记b]]';
      if ((fp as string).endsWith('b.md')) return '# 笔记B\n\n目标笔记';
      throw new Error(`Unexpected file: ${fp}`);
    });

    const result = analyzeAllNotes(vaultPath, {} as never);

    expect(result.graph.links).toHaveLength(1);
    expect(result.graph.links[0]).toEqual({ source: '笔记A', target: '笔记B' });

    const bBacklinks = result.backlinksMap.get('笔记B');
    expect(bBacklinks).toBeDefined();
    expect(bBacklinks).toHaveLength(1);
    expect(bBacklinks![0].title).toBe('笔记A');
  });

  it('文件读取失败（文件不存在）→ skip 该笔记，继续处理其他笔记', () => {
    const paperA = makePaper({ id: 1, title: '笔记A', filePath: 'notes/missing.md' });
    const paperB = makePaper({ id: 2, title: '笔记B', filePath: 'notes/b.md' });
    const paperC = makePaper({ id: 3, title: '笔记C', filePath: 'notes/c.md' });
    vi.mocked(getAllPapers).mockReturnValue([paperA, paperB, paperC]);
    const readFileMock = vi.mocked(fs.readFileSync);
    readFileMock.mockImplementation((fp: string) => {
      if ((fp as string).endsWith('missing.md')) throw new Error('ENOENT: no such file');
      if ((fp as string).endsWith('b.md')) return '# 笔记B\n\n参考 [[笔记C]]';
      if ((fp as string).endsWith('c.md')) return '# 笔记C\n\n独立笔记';
      throw new Error(`Unexpected file: ${fp}`);
    });

    const result = analyzeAllNotes(vaultPath, {} as never);

    // A should still be in nodes (all papers become nodes)
    expect(result.graph.nodes).toHaveLength(3);
    // Only B->C edge should exist (A was skipped)
    expect(result.graph.links).toHaveLength(1);
    expect(result.graph.links[0]).toEqual({ source: '笔记B', target: '笔记C' });

    const cBacklinks = result.backlinksMap.get('笔记C');
    expect(cBacklinks).toHaveLength(1);
    expect(cBacklinks![0].title).toBe('笔记B');
  });
});
