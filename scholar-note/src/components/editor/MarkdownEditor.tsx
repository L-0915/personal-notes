import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, lineNumbers } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches } from '@codemirror/search';
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { searchKeymap } from '@codemirror/search';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
  onScroll?: (fraction: number) => void;
}

export interface MarkdownEditorHandle {
  wrapSelection: (before: string, after: string) => void;
  insertAtCursor: (text: string) => void;
  getScrollFraction: () => number;
  setScrollFraction: (fraction: number) => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, theme = 'light', onScroll }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const syncRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown(),
      foldGutter(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace" },
      }),
    ];

    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Sync scroll to preview
    const scrollDom = view.scrollDOM;
    const handleEditorScroll = () => {
      if (syncRef.current) return;
      const maxScroll = scrollDom.scrollHeight - scrollDom.clientHeight;
      if (maxScroll > 0 && onScrollRef.current) {
        onScrollRef.current(scrollDom.scrollTop / maxScroll);
      }
    };
    scrollDom.addEventListener('scroll', handleEditorScroll);

    return () => {
      scrollDom.removeEventListener('scroll', handleEditorScroll);
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when theme changes
  }, [theme]);

  // Handle external value changes (e.g., switching notes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  // Handle image paste
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;

        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const ext = item.type.split('/')[1] || 'png';
          const result = await window.electronAPI.saveImage(base64, ext);
          if (result.success && result.path) {
            const view = viewRef.current;
            if (view) {
              const imgMarkdown = `![](${result.path})`;
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, insert: imgMarkdown },
              });
            }
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    };

    container.addEventListener('paste', handlePaste);
    return () => container.removeEventListener('paste', handlePaste);
  }, []);

  useImperativeHandle(ref, () => ({
    wrapSelection: (before: string, after: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      view.dispatch({
        changes: { from, to, insert: before + selected + after },
        selection: { anchor: from + before.length, head: from + before.length + selected.length },
      });
    },
    insertAtCursor: (text: string) => {
      const view = viewRef.current;
      if (!view) return;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: text },
        selection: { anchor: pos + text.length },
      });
    },
    getScrollFraction: () => {
      const view = viewRef.current;
      if (!view) return 0;
      const dom = view.scrollDOM;
      const max = dom.scrollHeight - dom.clientHeight;
      return max > 0 ? dom.scrollTop / max : 0;
    },
    setScrollFraction: (fraction: number) => {
      const view = viewRef.current;
      if (!view) return;
      syncRef.current = true;
      const dom = view.scrollDOM;
      dom.scrollTop = fraction * (dom.scrollHeight - dom.clientHeight);
      requestAnimationFrame(() => { syncRef.current = false; });
    },
  }));

  return <div className="markdown-editor" ref={containerRef} />;
  },
);
