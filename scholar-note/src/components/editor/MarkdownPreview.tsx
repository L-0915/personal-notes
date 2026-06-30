import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import type { Paper } from '@/types';
import { HoverPreview } from './HoverPreview';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import mermaid from 'mermaid';
import katex from '@traptitech/markdown-it-katex';
import 'katex/dist/katex.min.css';

interface MarkdownPreviewProps {
  content: string;
  onLocalFileClick?: (filePath: string) => void;
  onNoteLinkClick?: (noteTitle: string) => void;
  onScroll?: (fraction: number) => void;
  scrollFraction?: number;
  papers?: Paper[];
  onHoverNavigate?: (paper: Paper) => void;
}

export interface MarkdownPreviewHandle {
  getScrollFraction: () => number;
  setScrollFraction: (fraction: number) => void;
}

let mermaidCounter = 0;

mermaid.initialize({
  startOnLoad: false,
  theme: typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
  securityLevel: 'strict',
});

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

md.use(footnote).use(taskLists).use(emoji).use(katex, {
  throwOnError: false,
  strict: false,
  trust: true,
  errorColor: 'var(--danger)',
});

// Convert [[note title]] to wiki-link markdown syntax before rendering
function preprocessWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_match, title) => {
    return `[${title}](wiki-link:${encodeURIComponent(title)})`;
  });
}

const defaultRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

const WEB_SCHEMES = ['http://', 'https://', 'ftp://', 'mailto:', 'tel:', '#'];

// Add id attributes to headings for outline navigation
const defaultHeadingRender = md.renderer.rules.heading_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  const nextToken = tokens[idx + 1];
  if (nextToken && nextToken.content) {
    const slug = nextToken.content
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '');
    tokens[idx].attrSet('id', slug);
  }
  return defaultHeadingRender(tokens, idx, options, env, self);
};

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const hrefIndex = tokens[idx].attrIndex('href');
  if (hrefIndex >= 0) {
    const href = tokens[idx].attrGet('href') ?? '';
    if (href.startsWith('wiki-link:')) {
      tokens[idx].attrSet('data-note-link', decodeURIComponent(href.slice(10)));
      tokens[idx].attrJoin('class', 'note-link');
    } else {
      const isWebUrl = WEB_SCHEMES.some((s) => href.toLowerCase().startsWith(s));
      if (!isWebUrl && href.length > 0) {
        tokens[idx].attrSet('data-local-link', href);
        tokens[idx].attrJoin('class', 'local-link');
      }
    }
  }
  return defaultRender(tokens, idx, options, env, self);
};

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview({ content, onLocalFileClick, onNoteLinkClick, onScroll, scrollFraction, papers, onHoverNavigate }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const syncRef = useRef(false);
  const [hoverPreview, setHoverPreview] = useState<{ title: string; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    getScrollFraction: () => {
      const el = containerRef.current;
      if (!el) return 0;
      const max = el.scrollHeight - el.clientHeight;
      return max > 0 ? el.scrollTop / max : 0;
    },
    setScrollFraction: (fraction: number) => {
      const el = containerRef.current;
      if (!el) return;
      syncRef.current = true;
      el.scrollTop = fraction * (el.scrollHeight - el.clientHeight);
      requestAnimationFrame(() => { syncRef.current = false; });
    },
  }));

  // Scroll preview from external fraction (editor → preview)
  useEffect(() => {
    if (scrollFraction === undefined || !containerRef.current) return;
    syncRef.current = true;
    const el = containerRef.current;
    el.scrollTop = scrollFraction * (el.scrollHeight - el.clientHeight);
    requestAnimationFrame(() => { syncRef.current = false; });
  }, [scrollFraction]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const noteAnchor = target.closest<HTMLAnchorElement>('a[data-note-link]');
      if (noteAnchor && onNoteLinkClick) {
        e.preventDefault();
        onNoteLinkClick(noteAnchor.getAttribute('data-note-link') ?? '');
        return;
      }

      if (onLocalFileClick) {
        const fileAnchor = target.closest<HTMLAnchorElement>('a[data-local-link]');
        if (fileAnchor) {
          e.preventDefault();
          onLocalFileClick(fileAnchor.getAttribute('data-local-link') ?? fileAnchor.href);
        }
      }
    },
    [onLocalFileClick, onNoteLinkClick],
  );

  const handleMouseOver = useCallback((e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-note-link]');
    if (link) {
      const title = link.getAttribute('data-note-link') ?? '';
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setHoverPreview(null);
      hoverTimerRef.current = setTimeout(() => {
        setHoverPreview({ title, rect: link.getBoundingClientRect() });
      }, 300);
    } else {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setHoverPreview(null);
    }
  }, []);

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const relatedLink = (e.relatedTarget as HTMLElement)?.closest?.('a[data-note-link]') as HTMLAnchorElement | null;
    const currentLink = (e.target as HTMLElement)?.closest?.('a[data-note-link]') as HTMLAnchorElement | null;
    if (!relatedLink || relatedLink !== currentLink) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setHoverPreview(null);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const processed = preprocessWikiLinks(content);
    container.innerHTML = md.render(processed);

    // Fix relative image paths → vault:// protocol URLs
    container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('file:') && !src.startsWith('data:') && !src.startsWith('vault:')) {
        img.src = `vault://localhost/${src}`;
      }
    });

    const mermaidBlocks = container.querySelectorAll<HTMLElement>('code.language-mermaid');
    mermaidBlocks.forEach(async (block) => {
      const pre = block.parentElement;
      if (!pre) return;

      const id = `mermaid-${++mermaidCounter}`;
      const source = block.textContent ?? '';

      try {
        const { svg } = await mermaid.render(id, source);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch {
        const fallback = document.createElement('div');
        fallback.className = 'mermaid-error';
        fallback.textContent = 'Diagram rendering failed';
        pre.replaceWith(fallback);
      }
    });

    container.addEventListener('click', handleClick);
    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    // Preview → Editor scroll sync
    const handlePreviewScroll = () => {
      if (syncRef.current) return;
      const max = container.scrollHeight - container.clientHeight;
      if (max > 0 && onScrollRef.current) {
        onScrollRef.current(container.scrollTop / max);
      }
    };
    container.addEventListener('scroll', handlePreviewScroll);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('scroll', handlePreviewScroll);
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, [content, handleClick, handleMouseOver, handleMouseOut]);

  return (
    <>
      <div className="markdown-preview" ref={containerRef} />
      {hoverPreview && papers && onHoverNavigate && (
        <HoverPreview
          title={hoverPreview.title}
          rect={hoverPreview.rect}
          papers={papers}
          onNavigate={(paper) => {
            setHoverPreview(null);
            onHoverNavigate(paper);
          }}
          onClose={() => setHoverPreview(null)}
        />
      )}
    </>
  );
  },
);
