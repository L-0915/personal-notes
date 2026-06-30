import { useState, useEffect } from 'react';

interface BacklinkResult {
  title: string;
  abstract: string | null;
  year: number | null;
  filePath: string;
}

interface BacklinksPanelProps {
  noteTitle: string;
  onNavigate: (filePath: string) => void;
  onClose: () => void;
}

type LoadState = 'loading' | 'loaded' | 'error';

export function BacklinksPanel({ noteTitle, onNavigate, onClose }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkResult[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    window.electronAPI.getBacklinks(noteTitle).then((results) => {
      if (cancelled) return;
      setBacklinks(results);
      setState('loaded');
    }).catch(() => {
      if (cancelled) return;
      setState('error');
    });

    return () => { cancelled = true; };
  }, [noteTitle]);

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <span>反向链接 ({backlinks.length})</span>
        <button className="backlinks-close-btn" onClick={onClose} title="关闭反向链接">✕</button>
      </div>
      {state === 'loading' && (
        <div className="backlinks-loading">加载中...</div>
      )}
      {state === 'error' && (
        <div className="backlinks-error">加载失败</div>
      )}
      {state === 'loaded' && backlinks.length === 0 && (
        <div className="backlinks-empty">暂无其他笔记引用当前笔记</div>
      )}
      {state === 'loaded' && backlinks.length > 0 && (
        <ul className="backlinks-list">
          {backlinks.map((item) => (
            <li
              key={item.filePath}
              className="backlinks-item"
              onClick={() => onNavigate(item.filePath)}
            >
              <div className="backlinks-item-title">{item.title}</div>
              {(item.year || item.abstract) && (
                <div className="backlinks-item-meta">
                  {item.year ? `${item.year}` : ''}
                </div>
              )}
              {item.abstract && (
                <div className="backlinks-item-snippet">
                  {item.abstract.length > 100
                    ? item.abstract.slice(0, 100) + '...'
                    : item.abstract}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
