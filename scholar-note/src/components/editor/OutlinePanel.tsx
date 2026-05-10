import { useMemo } from 'react';

interface Heading {
  level: number;
  text: string;
  slug: string;
}

function extractHeadings(content: string): Heading[] {
  if (!content) return [];

  // Strip frontmatter
  const fmEnd = content.indexOf('---', 3);
  const body = fmEnd >= 0 ? content.slice(fmEnd + 3) : content;

  const headings: Heading[] = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(body)) !== null) {
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '');
    headings.push({ level: match[1].length, text, slug });
  }

  return headings;
}

interface OutlinePanelProps {
  content: string;
  onClose?: () => void;
}

export function OutlinePanel({ content, onClose }: OutlinePanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) {
    return (
      <div className="outline-panel">
        <div className="outline-header">
          <span>大纲</span>
          {onClose && (
            <button className="outline-close-btn" onClick={onClose} title="关闭大纲">✕</button>
          )}
        </div>
        <div className="outline-empty">暂无标题</div>
      </div>
    );
  }

  const scrollTo = (slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <span>大纲</span>
        {onClose && (
          <button className="outline-close-btn" onClick={onClose} title="关闭大纲">✕</button>
        )}
      </div>
      <ul className="outline-list">
        {headings.map((h, i) => (
          <li
            key={i}
            className="outline-item"
            style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
            onClick={() => scrollTo(h.slug)}
            title={h.text}
          >
            {h.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
