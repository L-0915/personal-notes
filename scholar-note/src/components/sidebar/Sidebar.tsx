import { useState, useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { SearchBar } from '@/components/sidebar/SearchBar';
import { FileTree } from '@/components/sidebar/FileTree';
import { TagList } from '@/components/sidebar/TagList';
import { RecentNotes } from '@/components/sidebar/RecentNotes';

export function Sidebar({ style }: { style?: React.CSSProperties }) {
  const setShowImportDialog = useUiStore((s) => s.setShowImportDialog);
  const setShowSettings = useUiStore((s) => s.setShowSettings);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [vaultPath, setVaultPath] = useState('');

  useEffect(() => {
    window.electronAPI?.getVaultPath?.().then(setVaultPath).catch(() => {});
  }, []);

  const handleCreateNote = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const result = await window.electronAPI.createNote(title);
    if (result.success) {
      setNewTitle('');
      setShowNewNote(false);
      // Reload papers
      const papers = await window.electronAPI.dbGetAllPapers();
      const { setPapers } = await import('@/stores/noteStore').then((m) => m.useNoteStore.getState());
      setPapers(papers);
    }
  };

  return (
    <aside className="sidebar" style={style}>
      <div className="sidebar-header">
        <span className="sidebar-title">ScholarNote</span>
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => setShowNewNote(!showNewNote)}
            aria-label="新建笔记"
            title="新建笔记"
          >
            +
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowImportDialog(true)}
            aria-label="导入"
            title="导入"
          >
            ↓
          </button>
          <ThemeToggle />
        </div>
      </div>

      {showNewNote && (
        <div className="new-note-input">
          <input
            type="text"
            placeholder="输入笔记标题..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNote();
              if (e.key === 'Escape') { setShowNewNote(false); setNewTitle(''); }
            }}
            autoFocus
          />
          <button className="btn-primary btn-sm" onClick={handleCreateNote}>创建</button>
        </div>
      )}

      <SearchBar />
      <RecentNotes />

      <div className="section-label">笔记列表</div>
      <FileTree />

      <TagList />

      <div className="sidebar-footer">
        <div className="sidebar-vault-path" title={vaultPath}>
          {vaultPath}
        </div>
        <button
          className="btn-secondary btn-sm sidebar-settings-btn"
          onClick={() => setShowSettings(true)}
        >
          设置
        </button>
      </div>
    </aside>
  );
}
