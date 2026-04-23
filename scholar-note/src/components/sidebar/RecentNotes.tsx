import { useMemo } from 'react';
import { useNoteStore } from '@/stores/noteStore';

export function RecentNotes() {
  const papers = useNoteStore((s) => s.papers);
  const currentPaper = useNoteStore((s) => s.currentPaper);
  const setCurrentPaper = useNoteStore((s) => s.setCurrentPaper);
  const setCurrentContent = useNoteStore((s) => s.setCurrentContent);

  const recent = useMemo(
    () =>
      [...papers]
        .sort((a, b) => b.updatedDate.localeCompare(a.updatedDate))
        .slice(0, 5),
    [papers],
  );

  if (recent.length === 0) return null;

  const handleSelect = async (paper: typeof recent[number]) => {
    setCurrentPaper(paper);
    try {
      const result = await window.electronAPI.readFile(paper.filePath);
      if (typeof result === 'string') setCurrentContent(result);
    } catch {
      setCurrentContent('');
    }
  };

  return (
    <div className="recent-notes">
      <div className="section-label">最近编辑</div>
      <ul className="recent-list">
        {recent.map((paper) => (
          <li
            key={paper.id}
            className={`recent-item${currentPaper?.id === paper.id ? ' active' : ''}${paper.pinned ? ' pinned' : ''}`}
            onClick={() => handleSelect(paper)}
            title={paper.title}
          >
            {paper.pinned && <span className="pin-icon">📌</span>}
            <span className="recent-title">{paper.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
