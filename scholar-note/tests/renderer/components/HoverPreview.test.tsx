// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { HoverPreview } from '@/components/editor/HoverPreview.js';
import type { Paper } from '@/types/index.js';

function makePaper(overrides: Partial<Paper> & { id: number; title: string }): Paper {
  return {
    slug: `slug-${overrides.id}`,
    filePath: `notes/slug-${overrides.id}.md`,
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

function mockRect(overrides: Partial<DOMRect> = {}): DOMRect {
  const base = {
    x: 100, y: 200, width: 120, height: 24,
    top: 200, right: 220, bottom: 224, left: 100,
    ...overrides,
  };
  return {
    ...base,
    toJSON: () => base,
  } as DOMRect;
}

describe('HoverPreview', () => {
  const onNavigate = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Set theme attribute for consistent snapshot behavior
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('匹配到论文时渲染卡片（标题、作者、摘要）', () => {
    const paper = makePaper({
      id: 1,
      title: '深度学习在自然语言处理中的应用',
      authors: [
        { id: 1, name: '张三' },
        { id: 2, name: '李四' },
      ],
      year: 2024,
      journal: 'Nature',
      abstract: '本文探讨了深度学习在NLP领域的应用，包括文本分类、情感分析等任务。',
    });

    const rect = mockRect();

    render(
      <HoverPreview
        title="深度学习在自然语言处理中的应用"
        rect={rect}
        papers={[paper]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('深度学习在自然语言处理中的应用')).toBeDefined();
    expect(screen.getByText('张三, 李四')).toBeDefined();
    expect(screen.getByText('2024 · Nature')).toBeDefined();
    expect(screen.getByText('本文探讨了深度学习在NLP领域的应用，包括文本分类、情感分析等任务。')).toBeDefined();
    expect(screen.getByText('点击打开笔记')).toBeDefined();
  });

  it('作者超过 3 人时显示前 3 人 + " 等"', () => {
    const paper = makePaper({
      id: 1,
      title: '多作者论文',
      authors: [
        { id: 1, name: '作者A' },
        { id: 2, name: '作者B' },
        { id: 3, name: '作者C' },
        { id: 4, name: '作者D' },
      ],
    });

    render(
      <HoverPreview
        title="多作者论文"
        rect={mockRect()}
        papers={[paper]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('作者A, 作者B, 作者C 等')).toBeDefined();
  });

  it('长摘要截断到 150 字符', () => {
    const paper = makePaper({
      id: 1,
      title: '长摘要论文',
      abstract: 'A'.repeat(200),
    });

    render(
      <HoverPreview
        title="长摘要论文"
        rect={mockRect()}
        papers={[paper]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('A'.repeat(150) + '...')).toBeDefined();
  });

  it('未匹配到论文时渲染 "未找到相关笔记"', () => {
    render(
      <HoverPreview
        title="不存在的笔记"
        rect={mockRect()}
        papers={[]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('未找到相关笔记')).toBeDefined();
    // Should not have "点击打开笔记" hint
    expect(screen.queryByText('点击打开笔记')).toBeNull();
  });

  it('点击卡片 → 调用 onNavigate(paper)', () => {
    const paper = makePaper({
      id: 1,
      title: '目标论文',
    });

    render(
      <HoverPreview
        title="目标论文"
        rect={mockRect()}
        papers={[paper]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('目标论文'));

    expect(onNavigate).toHaveBeenCalledWith(paper);
  });

  it('未匹配到论文时点击卡片不调用 onNavigate', () => {
    render(
      <HoverPreview
        title="不存在的笔记"
        rect={mockRect()}
        papers={[]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('未找到相关笔记'));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('点击卡片外部 → 调用 onClose', async () => {
    const paper = makePaper({ id: 1, title: '论文A' });

    render(
      <HoverPreview
        title="论文A"
        rect={mockRect()}
        papers={[paper]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    // The component uses setTimeout(0) before attaching the click listener
    await act(() => new Promise((r) => setTimeout(r, 10)));

    // Click on document body (outside the card)
    fireEvent.click(document.body);

    expect(onClose).toHaveBeenCalled();
  });

  it('按 Escape 键 → 调用 onClose', () => {
    render(
      <HoverPreview
        title="论文A"
        rect={mockRect()}
        papers={[]}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
