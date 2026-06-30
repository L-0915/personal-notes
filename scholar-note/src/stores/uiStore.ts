import { create } from 'zustand';

type Theme = 'light' | 'dark';
export type SortBy = 'title' | 'updatedDate' | 'addedDate' | 'rating';
export type ViewMode = 'preview' | 'edit' | 'graph';

interface UiState {
  theme: Theme;
  sidebarWidth: number;
  showImportDialog: boolean;
  showSettings: boolean;
  showExport: boolean;
  sortBy: SortBy;
  sortAsc: boolean;
  searchFocusCounter: number;
  showOutline: boolean;
  showBacklinks: boolean;
  viewMode: ViewMode;
}

interface UiActions {
  toggleTheme: () => void;
  setShowImportDialog: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowExport: (show: boolean) => void;
  setSortBy: (sortBy: SortBy) => void;
  toggleSortOrder: () => void;
  setSidebarWidth: (width: number) => void;
  triggerSearchFocus: () => void;
  toggleOutline: () => void;
  setShowBacklinks: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage may be unavailable in some environments
  }
  return 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  theme: getInitialTheme(),
  sidebarWidth: 240,
  showImportDialog: false,
  showSettings: false,
  showExport: false,
  sortBy: 'updatedDate',
  sortAsc: false,
  searchFocusCounter: 0,
  showOutline: false,
  showBacklinks: false,
  viewMode: 'preview' as ViewMode,

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ignore write failures
    }
    applyTheme(next);
    set({ theme: next });
  },

  setShowImportDialog: (show) => set({ showImportDialog: show }),

  setShowSettings: (show) => set({ showSettings: show }),

  setShowExport: (show) => set({ showExport: show }),

  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () => set((s) => ({ sortAsc: !s.sortAsc })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  triggerSearchFocus: () => set((s) => ({ searchFocusCounter: s.searchFocusCounter + 1 })),
  toggleOutline: () => set((s) => ({ showOutline: !s.showOutline })),
  setShowBacklinks: (show) => set({ showBacklinks: show }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
