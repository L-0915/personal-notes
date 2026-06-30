import { useUiStore } from '@/stores/uiStore';
import type { MarkdownEditorHandle } from '@/components/editor/MarkdownEditor';

interface EditorToolbarProps {
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
}

const TOOLS: Array<{ label: string; title: string; before: string; after: string }> = [
  { label: 'B', title: '加粗', before: '**', after: '**' },
  { label: 'I', title: '斜体', before: '*', after: '*' },
  { label: 'H1', title: '标题1', before: '# ', after: '' },
  { label: 'H2', title: '标题2', before: '## ', after: '' },
  { label: 'H3', title: '标题3', before: '### ', after: '' },
  { label: '—', title: '分隔线', before: '\n---\n', after: '' },
  { label: 'UL', title: '无序列表', before: '- ', after: '' },
  { label: 'OL', title: '有序列表', before: '1. ', after: '' },
  { label: '""', title: '引用', before: '> ', after: '' },
  { label: '<>', title: '代码块', before: '`', after: '`' },
  { label: '[]', title: '链接', before: '[', after: '](url)' },
  { label: '——', title: '表格', before: '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| ', after: ' |  |  |\n' },
];

export function EditorToolbar({ editorRef }: EditorToolbarProps) {
  const showOutline = useUiStore((s) => s.showOutline);
  const toggleOutline = useUiStore((s) => s.toggleOutline);
  const showBacklinks = useUiStore((s) => s.showBacklinks);
  const setShowBacklinks = useUiStore((s) => s.setShowBacklinks);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const setShowExport = useUiStore((s) => s.setShowExport);

  const handleClick = (before: string, after: string) => {
    if (editorRef.current) {
      editorRef.current.wrapSelection(before, after);
    }
  };

  return (
    <div className="editor-toolbar">
      {viewMode === 'edit' && TOOLS.map((tool) => (
        <button
          key={tool.label}
          className="toolbar-btn"
          title={tool.title}
          onClick={() => handleClick(tool.before, tool.after)}
        >
          {tool.label}
        </button>
      ))}
      <span className="toolbar-spacer" />
      <button
        className="toolbar-btn"
        title="导出笔记"
        onClick={() => setShowExport(true)}
      >
        💾
      </button>
      <button
        className="toolbar-btn"
        title={viewMode === 'preview' ? '编辑模式' : '预览模式'}
        onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')}
      >
        {viewMode === 'preview' ? '✏️' : '👁'}
      </button>
      <button
        className={`toolbar-btn${showOutline ? ' active' : ''}`}
        title="大纲导航"
        onClick={toggleOutline}
      >
        ☰
      </button>
      <button
        className={`toolbar-btn${showBacklinks ? ' active' : ''}`}
        title="反向链接"
        onClick={() => setShowBacklinks(!showBacklinks)}
      >
        🔗
      </button>
      <button
        className={`toolbar-btn${viewMode === 'graph' ? ' active' : ''}`}
        title="关系图谱"
        onClick={() => setViewMode(viewMode === 'graph' ? 'preview' : 'graph')}
      >
        📊
      </button>
    </div>
  );
}
