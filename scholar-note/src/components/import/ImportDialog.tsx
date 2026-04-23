import { useState, useRef, useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

type Tab = 'online' | 'local';

export function ImportDialog() {
  const showImportDialog = useUiStore((s) => s.showImportDialog);
  const setShowImportDialog = useUiStore((s) => s.setShowImportDialog);

  const [tab, setTab] = useState<Tab>('online');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showImportDialog) {
      setInput('');
      setError(null);
      setMessage(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showImportDialog]);

  if (!showImportDialog) return null;

  const reloadPapers = async () => {
    const papers = await window.electronAPI.dbGetAllPapers();
    const { setPapers } = await import('@/stores/noteStore').then((m) => m.useNoteStore.getState());
    setPapers(papers);
    const tags = await window.electronAPI.dbGetTags();
    const { setTags } = await import('@/stores/tagStore').then((m) => m.useTagStore.getState());
    setTags(tags);
  };

  const handleOnlineImport = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.importPaper(trimmed);
      if (result.success) {
        await reloadPapers();
        setShowImportDialog(false);
      } else {
        setError(result.error ?? '导入失败');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleImportMd = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await window.electronAPI.importLocalMd();
      if (result.imported.length > 0) {
        await reloadPapers();
        setMessage(`成功导入 ${result.imported.length} 个 Markdown 文件`);
      }
      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }
      if (result.imported.length > 0 && result.errors.length === 0) {
        setShowImportDialog(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && tab === 'online') {
      handleOnlineImport();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowImportDialog(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleBackdropClick}>
      <div className="dialog">
        <h3>导入</h3>

        <div className="dialog-tabs">
          <button
            className={`dialog-tab${tab === 'online' ? ' active' : ''}`}
            onClick={() => { setTab('online'); setError(null); setMessage(null); }}
          >
            在线导入
          </button>
          <button
            className={`dialog-tab${tab === 'local' ? ' active' : ''}`}
            onClick={() => { setTab('local'); setError(null); setMessage(null); }}
          >
            本地导入
          </button>
        </div>

        {tab === 'online' && (
          <>
            <p className="dialog-hint">
              粘贴 DOI、arXiv 链接或 Semantic Scholar 链接
            </p>
            <input
              ref={inputRef}
              className="dialog-input"
              type="text"
              placeholder="https://doi.org/... 或 10.xxxx/..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </>
        )}

        {tab === 'local' && (
          <div className="dialog-local-import">
            <p className="dialog-hint">从本地导入 Markdown 文件到仓库</p>
            <button
              className="btn-primary dialog-import-btn"
              onClick={handleImportMd}
              disabled={loading}
            >
              {loading ? '导入中...' : '导入 Markdown 文件'}
            </button>
          </div>
        )}

        {error && <div className="dialog-error">{error}</div>}
        {message && <div className="dialog-message">{message}</div>}

        <div className="dialog-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowImportDialog(false)}
            disabled={loading}
          >
            关闭
          </button>
          {tab === 'online' && (
            <button
              className="btn-primary"
              onClick={handleOnlineImport}
              disabled={loading || !input.trim()}
            >
              {loading ? '导入中...' : '导入'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
