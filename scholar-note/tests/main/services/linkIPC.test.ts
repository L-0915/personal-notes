import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandle, mockAnalyzeAllNotes } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockAnalyzeAllNotes: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle,
  },
}));

vi.mock('@electron/services/linkAnalyzer.js', () => ({
  analyzeAllNotes: mockAnalyzeAllNotes,
}));

import { registerLinkIPC } from '@electron/ipc/linkIPC.js';

describe('registerLinkIPC', () => {
  const getVaultPath = vi.fn(() => 'D:/test-vault');
  const db = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('注册 note:getBacklinks 和 note:getLinkGraph 两个 handler', () => {
    registerLinkIPC(getVaultPath, db);

    expect(mockHandle).toHaveBeenCalledTimes(2);
    expect(mockHandle).toHaveBeenCalledWith('note:getBacklinks', expect.any(Function));
    expect(mockHandle).toHaveBeenCalledWith('note:getLinkGraph', expect.any(Function));
  });

  describe('note:getBacklinks handler', () => {
    it('传入存在的标题 → 返回正确的 backlinks 数组', () => {
      const backlinksMap = new Map();
      backlinksMap.set('笔记B', [
        { title: '笔记A', abstract: null, year: 2024, filePath: 'notes/a.md' },
      ]);
      mockAnalyzeAllNotes.mockReturnValue({
        backlinksMap,
        graph: { nodes: [], links: [] },
      });

      registerLinkIPC(getVaultPath, db);

      const handler = mockHandle.mock.calls.find(
        (call: [string, Function]) => call[0] === 'note:getBacklinks',
      )![1];

      const result = handler({}, '笔记B');

      expect(getVaultPath).toHaveBeenCalled();
      expect(mockAnalyzeAllNotes).toHaveBeenCalledWith('D:/test-vault', db);
      expect(result).toEqual([
        { title: '笔记A', abstract: null, year: 2024, filePath: 'notes/a.md' },
      ]);
    });

    it('传入不存在的标题 → 返回空数组', () => {
      mockAnalyzeAllNotes.mockReturnValue({
        backlinksMap: new Map(),
        graph: { nodes: [], links: [] },
      });

      registerLinkIPC(getVaultPath, db);

      const handler = mockHandle.mock.calls.find(
        (call: [string, Function]) => call[0] === 'note:getBacklinks',
      )![1];

      const result = handler({}, '不存在的笔记');

      expect(result).toEqual([]);
    });
  });

  describe('note:getLinkGraph handler', () => {
    it('返回正确的 graph 结构', () => {
      const graph = {
        nodes: [
          { id: 1, title: '笔记A', filePath: 'notes/a.md' },
          { id: 2, title: '笔记B', filePath: 'notes/b.md' },
        ],
        links: [
          { source: '笔记A', target: '笔记B' },
        ],
      };
      mockAnalyzeAllNotes.mockReturnValue({
        backlinksMap: new Map(),
        graph,
      });

      registerLinkIPC(getVaultPath, db);

      const handler = mockHandle.mock.calls.find(
        (call: [string, Function]) => call[0] === 'note:getLinkGraph',
      )![1];

      const result = handler();

      expect(result).toEqual(graph);
      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });

    it('空图 → 返回空的 nodes 和 links', () => {
      mockAnalyzeAllNotes.mockReturnValue({
        backlinksMap: new Map(),
        graph: { nodes: [], links: [] },
      });

      registerLinkIPC(getVaultPath, db);

      const handler = mockHandle.mock.calls.find(
        (call: [string, Function]) => call[0] === 'note:getLinkGraph',
      )![1];

      const result = handler();

      expect(result).toEqual({ nodes: [], links: [] });
    });
  });
});
