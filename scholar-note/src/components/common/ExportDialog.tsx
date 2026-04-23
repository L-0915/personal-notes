import { useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useNoteStore } from '@/stores/noteStore';

type ExportFormat = 'pdf' | 'docx' | 'html' | 'md';

interface FormatOption {
  key: ExportFormat;
  label: string;
  desc: string;
  icon: string;
}

const FORMATS: FormatOption[] = [
  { key: 'pdf', label: 'PDF 文件', desc: '适合打印和分享，保留完整排版', icon: '📄' },
  { key: 'docx', label: 'Word 文档', desc: '可在 Microsoft Word 中编辑', icon: '📝' },
  { key: 'html', label: 'HTML 网页', desc: '可在浏览器中查看，保留完整样式', icon: '🌐' },
  { key: 'md', label: 'Markdown', desc: '纯文本格式，通用性最强', icon: '📋' },
];

export function ExportDialog() {
  const showExport = useUiStore((s) => s.showExport);
  const setShowExport = useUiStore((s) => s.setShowExport);
  const currentContent = useNoteStore((s) => s.currentContent);
  const currentPaper = useNoteStore((s) => s.currentPaper);

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!showExport || !currentPaper) return null;

  const handleExport = async () => {
    if (!currentContent) return;
    setExporting(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.exportNote(
        format,
        currentContent,
        currentPaper.title,
      );
      if (result.success) {
        setMessage({ type: 'success', text: `已导出到: ${result.filePath}` });
      } else if (result.error) {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '导出失败' });
    } finally {
      setExporting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowExport(false);
  };

  return (
    <div className="dialog-overlay" onClick={handleBackdropClick}>
      <div className="dialog">
        <h3>导出笔记</h3>
        <p className="dialog-hint">
          选择导出格式 — <strong>{currentPaper.title}</strong>
        </p>

        <div className="export-formats">
          {FORMATS.map((f) => (
            <label
              key={f.key}
              className={`export-format-option${format === f.key ? ' selected' : ''}`}
            >
              <input
                type="radio"
                name="export-format"
                value={f.key}
                checked={format === f.key}
                onChange={() => setFormat(f.key)}
              />
              <span className="export-format-icon">{f.icon}</span>
              <div className="export-format-info">
                <span className="export-format-label">{f.label}</span>
                <span className="export-format-desc">{f.desc}</span>
              </div>
            </label>
          ))}
        </div>

        {message && (
          <div className={`dialog-${message.type}`}>{message.text}</div>
        )}

        <div className="dialog-actions">
          <button
            className="btn-secondary"
            onClick={() => { setShowExport(false); setMessage(null); }}
            disabled={exporting}
          >
            关闭
          </button>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
