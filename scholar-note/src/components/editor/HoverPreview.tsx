import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Paper } from '@/types';

interface HoverPreviewProps {
  title: string;
  rect: DOMRect;
  papers: Paper[];
  onNavigate: (paper: Paper) => void;
  onClose: () => void;
}

export function HoverPreview({ title, rect, papers, onNavigate, onClose }: HoverPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const paper = useMemo(() => {
    const lower = title.toLowerCase();
    return papers.find((p) => p.title.toLowerCase() === lower) ?? null;
  }, [title, papers]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey, { capture: true });
    return () => document.removeEventListener('keydown', handleKey, { capture: true });
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  const CARD_WIDTH = 380;
  const CARD_GAP = 8;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const linkCenterX = rect.left + rect.width / 2;
  const linkTop = rect.top;
  const linkBottom = rect.bottom;

  let left = linkCenterX - CARD_WIDTH / 2;
  if (left < 8) left = 8;
  if (left + CARD_WIDTH > viewportW - 8) left = viewportW - CARD_WIDTH - 8;

  const spaceAbove = linkTop - CARD_GAP;
  const spaceBelow = viewportH - linkBottom - CARD_GAP;
  const showAbove = spaceAbove >= 120 || spaceAbove >= spaceBelow;

  // Render after mount so we have card height for positioning
  const top = showAbove ? undefined : linkBottom + CARD_GAP;

  const authorsText = paper
    ? paper.authors.length > 3
      ? paper.authors.slice(0, 3).map((a) => a.name).join(', ') + ' 等'
      : paper.authors.map((a) => a.name).join(', ')
    : '';

  const metaText = paper
    ? [paper.year, paper.journal].filter(Boolean).join(' · ')
    : '';

  const abstractSnippet = paper?.abstract
    ? paper.abstract.length > 150
      ? paper.abstract.slice(0, 150) + '...'
      : paper.abstract
    : '';

  return createPortal(
    <div
      ref={cardRef}
      className="hover-preview-card"
      style={{
        left: `${left}px`,
        ...(showAbove ? { bottom: `${viewportH - linkTop + CARD_GAP}px` } : { top: `${top}px` }),
      }}
      onClick={(e) => {
        if (paper) {
          e.stopPropagation();
          onNavigate(paper);
        }
      }}
    >
      <style>{`
        @keyframes hover-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hover-preview-card {
          position: fixed;
          z-index: 1000;
          max-width: 380px;
          min-width: 280px;
          padding: 14px 18px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: ${document.documentElement.getAttribute('data-theme') === 'dark'
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(0,0,0,0.15)'};
          font-size: 0.82rem;
          line-height: 1.55;
          color: var(--text-primary);
          pointer-events: auto;
          animation: hover-fade-in 0.15s ease-out;
          cursor: ${paper ? 'pointer' : 'default'};
        }
        .hover-preview-title {
          font-weight: 600;
          font-size: 0.88rem;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 6px;
        }
        .hover-preview-authors {
          color: var(--text-secondary);
          font-size: 0.78rem;
          margin-bottom: 2px;
        }
        .hover-preview-meta {
          color: var(--text-secondary);
          font-size: 0.78rem;
          margin-bottom: 6px;
        }
        .hover-preview-abstract {
          color: var(--text-primary);
          font-size: 0.78rem;
          line-height: 1.55;
          opacity: 0.85;
          margin-bottom: 8px;
        }
        .hover-preview-hint {
          color: var(--text-secondary);
          font-size: 0.72rem;
          text-align: right;
          opacity: 0.7;
        }
      `}</style>
      {paper ? (
        <>
          <div className="hover-preview-title">{paper.title}</div>
          {authorsText && <div className="hover-preview-authors">{authorsText}</div>}
          {metaText && <div className="hover-preview-meta">{metaText}</div>}
          {abstractSnippet && <div className="hover-preview-abstract">{abstractSnippet}</div>}
          <div className="hover-preview-hint">点击打开笔记</div>
        </>
      ) : (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
          未找到相关笔记
        </div>
      )}
    </div>,
    document.body,
  );
}
