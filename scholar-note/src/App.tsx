import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useNoteStore } from '@/stores/noteStore';
import { useTagStore } from '@/stores/tagStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { ImportDialog } from '@/components/import/ImportDialog';
import { SettingsDialog } from '@/components/common/SettingsDialog';
import { ExportDialog } from '@/components/common/ExportDialog';

export default function App() {
  const theme = useUiStore((s) => s.theme);
  const setShowImportDialog = useUiStore((s) => s.setShowImportDialog);
  const triggerSearchFocus = useUiStore((s) => s.triggerSearchFocus);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+N — open import dialog
      if (mod && e.key === 'n') {
        e.preventDefault();
        setShowImportDialog(true);
      }

      // Ctrl+, — open settings
      if (mod && e.key === ',') {
        e.preventDefault();
        useUiStore.getState().setShowSettings(true);
      }

      // Ctrl+S — force save current note
      if (mod && e.key === 's') {
        e.preventDefault();
        const { currentPaper, currentContent } = useNoteStore.getState();
        if (currentPaper?.filePath && currentContent) {
          window.electronAPI.writeFile(currentPaper.filePath, currentContent).catch(() => {});
        }
      }

      // Ctrl+F — focus search bar
      if (mod && e.key === 'f') {
        e.preventDefault();
        triggerSearchFocus();
      }

      // Ctrl+E — toggle preview/edit mode
      if (mod && e.key === 'e') {
        e.preventDefault();
        const { viewMode, setViewMode } = useUiStore.getState();
        setViewMode(viewMode === 'preview' ? 'edit' : 'preview');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setShowImportDialog, triggerSearchFocus]);

  // Drag-drop import — accept .md files dropped onto the window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const mdPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const name = files[i].name;
        if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
          mdPaths.push((files[i] as File & { path: string }).path);
        }
      }
      if (mdPaths.length === 0) return;

      try {
        const result = await window.electronAPI.importDropFiles(mdPaths);
        if (result.imported > 0) {
          const papers = await window.electronAPI.dbGetAllPapers();
          useNoteStore.getState().setPapers(papers);
          const tags = await window.electronAPI.dbGetTags();
          useTagStore.getState().setTags(tags);
        }
      } catch { /* ignore */ }
    };
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Load initial data + start file watcher
  useEffect(() => {
    const loadData = async () => {
      try {
        const papers = await window.electronAPI.dbGetAllPapers();
        useNoteStore.getState().setPapers(papers);
        const tags = await window.electronAPI.dbGetTags();
        useTagStore.getState().setTags(tags);
      } catch {
        // App may be running outside Electron
      }
    };

    const startWatching = async () => {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        await window.electronAPI.startWatcher(vaultPath);
      } catch {
        // File watcher may not be available
      }
    };

    loadData();
    startWatching();

    // Listen for file changes — reload data when files change
    const unsubChanged = window.electronAPI.onFileChanged(() => {
      loadData();
    });
    const unsubAdded = window.electronAPI.onFileAdded(() => {
      loadData();
    });

    return () => {
      unsubChanged();
      unsubAdded();
      window.electronAPI.stopWatcher().catch(() => {});
    };
  }, []);

  return (
    <>
      <AppLayout />
      <ImportDialog />
      <SettingsDialog />
      <ExportDialog />
    </>
  );
}
