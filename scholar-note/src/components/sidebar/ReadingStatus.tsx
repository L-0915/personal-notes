import { useMemo } from 'react';
import { useNoteStore } from '@/stores/noteStore';

interface StatusEntry {
  status: string;
  label: string;
  count: number;
}

export function ReadingStatus() {
  const papers = useNoteStore((s) => s.papers);

  const statuses: StatusEntry[] = useMemo(() => {
    const counts = { 'to-read': 0, reading: 0, read: 0 };
    for (const p of papers) {
      counts[p.readingStatus] += 1;
    }
    return [
      { status: 'to-read', label: '待读', count: counts['to-read'] },
      { status: 'reading', label: '在读', count: counts.reading },
      { status: 'read', label: '已读', count: counts.read },
    ];
  }, [papers]);

  return (
    <div className="reading-status">
      {statuses.map((s) => (
        <span key={s.status} className="status-item" title={s.label}>
          <span className={`status-dot ${s.status}`} />
          {s.label} {s.count}
        </span>
      ))}
    </div>
  );
}
