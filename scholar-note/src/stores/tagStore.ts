import { create } from 'zustand';
import type { Tag } from '@/types';

interface TagState {
  tags: Tag[];
  selectedTags: string[];
}

interface TagActions {
  setTags: (tags: Tag[]) => void;
  toggleTag: (tagName: string) => void;
  clearSelection: () => void;
}

export const useTagStore = create<TagState & TagActions>((set) => ({
  tags: [],
  selectedTags: [],

  setTags: (tags) => set({ tags }),

  toggleTag: (tagName) =>
    set((state) => {
      const isSelected = state.selectedTags.includes(tagName);
      return {
        selectedTags: isSelected
          ? state.selectedTags.filter((t) => t !== tagName)
          : [...state.selectedTags, tagName],
      };
    }),

  clearSelection: () => set({ selectedTags: [] }),
}));
