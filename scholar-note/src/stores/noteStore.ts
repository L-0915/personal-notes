import { create } from 'zustand';
import type { Paper, ReadingStatus } from '@/types';

interface NoteState {
  papers: Paper[];
  currentPaper: Paper | null;
  currentContent: string;
  isLoading: boolean;
}

interface NoteActions {
  setPapers: (papers: Paper[]) => void;
  setCurrentPaper: (paper: Paper | null) => void;
  setCurrentContent: (content: string) => void;
  setLoading: (loading: boolean) => void;
  updatePaperStatus: (id: number, status: ReadingStatus) => void;
  updatePaperRating: (id: number, rating: number) => void;
}

export const useNoteStore = create<NoteState & NoteActions>((set) => ({
  papers: [],
  currentPaper: null,
  currentContent: '',
  isLoading: false,

  setPapers: (papers) => set({ papers }),

  setCurrentPaper: (paper) => set({ currentPaper: paper }),

  setCurrentContent: (content) => set({ currentContent: content }),

  setLoading: (isLoading) => set({ isLoading }),

  updatePaperStatus: (id, status) =>
    set((state) => ({
      papers: state.papers.map((p) =>
        p.id === id ? { ...p, readingStatus: status } : p,
      ),
      currentPaper:
        state.currentPaper?.id === id
          ? { ...state.currentPaper, readingStatus: status }
          : state.currentPaper,
    })),

  updatePaperRating: (id, rating) =>
    set((state) => ({
      papers: state.papers.map((p) =>
        p.id === id ? { ...p, rating } : p,
      ),
      currentPaper:
        state.currentPaper?.id === id
          ? { ...state.currentPaper, rating }
          : state.currentPaper,
    })),
}));
