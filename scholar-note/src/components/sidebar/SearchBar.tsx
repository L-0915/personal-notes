import { useState, useRef, useCallback, useEffect } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import { useUiStore } from '@/stores/uiStore';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setPapers = useNoteStore((s) => s.setPapers);
  const searchFocusCounter = useUiStore((s) => s.searchFocusCounter);

  // Focus search input when triggered (Ctrl+F)
  useEffect(() => {
    if (searchFocusCounter > 0 && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [searchFocusCounter]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (!value.trim()) {
        timerRef.current = setTimeout(async () => {
          try {
            const papers = await window.electronAPI.dbGetAllPapers();
            setPapers(papers);
          } catch { /* ignore */ }
        }, 200);
        return;
      }

      timerRef.current = setTimeout(async () => {
        try {
          const results = await window.electronAPI.dbSearchPapers(value.trim());
          if (results.length > 0) {
            const papers = await window.electronAPI.dbGetAllPapers();
            const resultIds = new Set(results.map((r) => r.id));
            setPapers(papers.filter((p) => resultIds.has(p.id)));
          } else {
            setPapers([]);
          }
        } catch { /* ignore */ }
      }, 300);
    },
    [setPapers],
  );

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="搜索笔记... (Ctrl+F)"
        value={query}
        onChange={handleChange}
      />
    </div>
  );
}
