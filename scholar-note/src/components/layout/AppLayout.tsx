import { useCallback, useEffect, useRef } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import { useUiStore } from '@/stores/uiStore';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import type { MarkdownEditorHandle } from '@/components/editor/MarkdownEditor';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import type { MarkdownPreviewHandle } from '@/components/editor/MarkdownPreview';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutlinePanel } from '@/components/editor/OutlinePanel';
import { BacklinksPanel } from '@/components/editor/BacklinksPanel';
import { GraphView } from '@/components/graph/GraphView';

const URL_DOI_PATTERNS = [
  /https?:\/\/arxiv\.org\/(?:abs|pdf|html)\/\d+\.\d+(?:v\d+)?/gi,
  /https?:\/\/doi\.org\/10\.\d{4,}\/[^\s)]+/gi,
  /https?:\/\/www\.semanticscholar\.org\/paper\/[^\s)]+/gi,
  /\b10\.\d{4,}\/[^\s)]+/gi,
];

function detectUrlOrDoi(content: string): string | null {
  const fmEnd = content.indexOf('---', 3);
  const body = fmEnd >= 0 ? content.slice(fmEnd + 3) : content;

  for (const pattern of URL_DOI_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(body);
    if (match) return match[0];
  }
  return null;
}

export function AppLayout() {
  const currentContent = useNoteStore((s) => s.currentContent);
  const setCurrentContent = useNoteStore((s) => s.setCurrentContent);
  const currentPaper = useNoteStore((s) => s.currentPaper);
  const setCurrentPaper = useNoteStore((s) => s.setCurrentPaper);
  const papers = useNoteStore((s) => s.papers);
  const setPapers = useNoteStore((s) => s.setPapers);
  const theme = useUiStore((s) => s.theme);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const showOutline = useUiStore((s) => s.showOutline);
  const toggleOutline = useUiStore((s) => s.toggleOutline);
  const showBacklinks = useUiStore((s) => s.showBacklinks);
  const setShowBacklinks = useUiStore((s) => s.setShowBacklinks);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const previewRef = useRef<MarkdownPreviewHandle>(null);
  const processedRef = useRef<Set<string>>(new Set());
  const importingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-save with 1s debounce
  useEffect(() => {
    if (!currentPaper?.filePath || !currentContent) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await window.electronAPI.writeFile(currentPaper.filePath, currentContent);
      } catch {
        // Silent fail — will retry on next change
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentContent, currentPaper?.filePath]);

  // Auto-detect URL/DOI → silently create a new note
  useEffect(() => {
    if (!currentContent || !currentPaper?.filePath) return;

    const timer = setTimeout(async () => {
      const found = detectUrlOrDoi(currentContent);
      if (!found || processedRef.current.has(found) || importingRef.current) return;

      processedRef.current.add(found);
      importingRef.current = true;

      try {
        const result = await window.electronAPI.importPaper(found);
        if (result.success) {
          // Reload papers and tags so the new note appears in sidebar
          const papers = await window.electronAPI.dbGetAllPapers();
          setPapers(papers);
          const tags = await window.electronAPI.dbGetTags();
          const { useTagStore } = await import('@/stores/tagStore');
          useTagStore.getState().setTags(tags);
        }
      } catch { /* ignore */ }
      importingRef.current = false;
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentContent, currentPaper?.filePath, setPapers]);

  const handleLocalFileClick = useCallback(async (filePath: string) => {
    await window.electronAPI.openLocalFile(filePath);
  }, []);

  const handleNoteLinkClick = useCallback(async (noteTitle: string) => {
    const found = papers.find(
      (p) => p.title.toLowerCase() === noteTitle.toLowerCase(),
    );
    if (!found) return;
    setCurrentPaper(found);
    try {
      const result = await window.electronAPI.readFile(found.filePath);
      if (typeof result === 'string') {
        setCurrentContent(result);
      }
    } catch {
      setCurrentContent('');
    }
  }, [papers, setCurrentPaper, setCurrentContent]);

  // Bidirectional scroll sync
  const syncingRef = useRef(false);
  const prevModeRef = useRef(viewMode);
  const savedFractionRef = useRef(0);

  // Save scroll position when switching modes, restore after new component renders
  useEffect(() => {
    if (prevModeRef.current !== viewMode) {
      // Save scroll from the outgoing component
      if (prevModeRef.current === 'edit') {
        savedFractionRef.current = editorRef.current?.getScrollFraction() ?? 0;
      } else {
        savedFractionRef.current = previewRef.current?.getScrollFraction() ?? 0;
      }
      prevModeRef.current = viewMode;
    }
  }, [viewMode]);

  // Restore scroll position after component renders
  useEffect(() => {
    if (savedFractionRef.current > 0) {
      const fraction = savedFractionRef.current;
      requestAnimationFrame(() => {
        if (viewMode === 'edit') {
          editorRef.current?.setScrollFraction(fraction);
        } else {
          previewRef.current?.setScrollFraction(fraction);
        }
        savedFractionRef.current = 0;
      });
    }
  }, [viewMode]);

  const handleEditorScroll = useCallback((fraction: number) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    previewRef.current?.setScrollFraction(fraction);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  const handlePreviewScroll = useCallback((fraction: number) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    editorRef.current?.setScrollFraction(fraction);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  return (
    <div className="app-layout">
      <Sidebar style={{ width: sidebarWidth }} />
      <div
        className="sidebar-resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = sidebarWidth;
          const onMove = (ev: MouseEvent) => {
            const next = Math.max(180, Math.min(500, startWidth + ev.clientX - startX));
            setSidebarWidth(next);
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />
      <div className="main-content">
        {currentPaper ? (
          <>
            <EditorToolbar editorRef={editorRef} />
            {viewMode === 'graph' ? (
              <GraphView
                papers={papers}
                onNavigate={(paper) => {
                  setCurrentPaper(paper);
                  window.electronAPI.readFile(paper.filePath).then((result) => {
                    if (typeof result === 'string') setCurrentContent(result);
                  }).catch(() => setCurrentContent(''));
                  setViewMode('preview');
                }}
              />
            ) : viewMode === 'edit' ? (
              <MarkdownEditor
                ref={editorRef}
                value={currentContent}
                onChange={setCurrentContent}
                theme={theme}
                onScroll={handleEditorScroll}
              />
            ) : (
              <div className="preview-full" style={{ position: 'relative', height: '100%' }}>
                <MarkdownPreview
                  ref={previewRef}
                  content={currentContent}
                  onLocalFileClick={handleLocalFileClick}
                  onNoteLinkClick={handleNoteLinkClick}
                  onScroll={handlePreviewScroll}
                  papers={papers}
                  onHoverNavigate={(paper) => {
                    setCurrentPaper(paper);
                    window.electronAPI.readFile(paper.filePath).then((result) => {
                      if (typeof result === 'string') setCurrentContent(result);
                    }).catch(() => setCurrentContent(''));
                  }}
                />
                {showOutline && <OutlinePanel content={currentContent} onClose={() => toggleOutline()} />}
                {showBacklinks && currentPaper && (
                  <BacklinksPanel
                    noteTitle={currentPaper.title}
                    onNavigate={(filePath) => {
                      const paper = papers.find((p) => p.filePath === filePath);
                      if (paper) {
                        setCurrentPaper(paper);
                        window.electronAPI.readFile(filePath).then((result) => {
                          if (typeof result === 'string') setCurrentContent(result);
                        }).catch(() => setCurrentContent(''));
                      }
                    }}
                    onClose={() => setShowBacklinks(false)}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="editor-empty">
            <div className="editor-empty-icon">📝</div>
            <div className="editor-empty-text">选择或创建一篇笔记开始写作</div>
            <div className="editor-empty-hint">Ctrl+N 导入 | 拖拽 .md 文件导入</div>
          </div>
        )}
      </div>
    </div>
  );
}
