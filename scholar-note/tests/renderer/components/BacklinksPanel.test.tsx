// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BacklinksPanel } from '@/components/editor/BacklinksPanel.js';

function mockElectronAPI(overrides: Partial<typeof window.electronAPI> = {}) {
  window.electronAPI = {
    getBacklinks: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as typeof window.electronAPI;
}

describe('BacklinksPanel', () => {
  const onNavigate = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    // @ts-expect-error cleanup
    delete window.electronAPI;
  });

  it('加载中状态 → 显示 "加载中..."', () => {
    mockElectronAPI({
      getBacklinks: () => new Promise(() => {}),
    });

    render(
      <BacklinksPanel
        noteTitle="测试笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('加载中...')).toBeDefined();
  });

  it('空数据状态 → 显示 "暂无其他笔记引用当前笔记"', async () => {
    mockElectronAPI({
      getBacklinks: vi.fn().mockResolvedValue([]),
    });

    render(
      <BacklinksPanel
        noteTitle="测试笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无其他笔记引用当前笔记')).toBeDefined();
    });
  });

  it('有数据状态 → 显示正确的 backlinks 列表', async () => {
    mockElectronAPI({
      getBacklinks: vi.fn().mockResolvedValue([
        { title: '引用笔记1', abstract: '这是摘要1', year: 2024, filePath: 'notes/ref1.md' },
        { title: '引用笔记2', abstract: null, year: null, filePath: 'notes/ref2.md' },
      ]),
    });

    render(
      <BacklinksPanel
        noteTitle="被引用的笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('引用笔记1')).toBeDefined();
    });

    expect(screen.getByText('引用笔记2')).toBeDefined();
    // Header shows count
    expect(screen.getByText('反向链接 (2)')).toBeDefined();
    // Abstract snippet (truncated if > 100 chars)
    expect(screen.getByText('这是摘要1')).toBeDefined();
  });

  it('点击 backlink 项 → 调用 onNavigate(filePath)', async () => {
    mockElectronAPI({
      getBacklinks: vi.fn().mockResolvedValue([
        { title: '引用笔记', abstract: null, year: null, filePath: 'notes/ref.md' },
      ]),
    });

    render(
      <BacklinksPanel
        noteTitle="目标笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('引用笔记')).toBeDefined();
    });

    fireEvent.click(screen.getByText('引用笔记'));

    expect(onNavigate).toHaveBeenCalledWith('notes/ref.md');
  });

  it('点击关闭按钮 → 调用 onClose', async () => {
    mockElectronAPI({
      getBacklinks: vi.fn().mockResolvedValue([
        { title: '引用笔记', abstract: null, year: null, filePath: 'notes/ref.md' },
      ]),
    });

    render(
      <BacklinksPanel
        noteTitle="目标笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('引用笔记')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('关闭反向链接');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('错误状态 → 显示 "加载失败"', async () => {
    mockElectronAPI({
      getBacklinks: vi.fn().mockRejectedValue(new Error('IPC error')),
    });

    render(
      <BacklinksPanel
        noteTitle="测试笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeDefined();
    });
  });

  it('长摘要 → 截断到 100 字符并加省略号', async () => {
    const longAbstract = 'A'.repeat(150);
    mockElectronAPI({
      getBacklinks: vi.fn().mockResolvedValue([
        { title: '引用笔记', abstract: longAbstract, year: null, filePath: 'notes/ref.md' },
      ]),
    });

    render(
      <BacklinksPanel
        noteTitle="目标笔记"
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      const snippet = screen.getByText(new RegExp(`^${'A'.repeat(100)}\\.\\.\\.$`));
      expect(snippet).toBeDefined();
    });
  });
});
