/// <reference types="vite/client" />

// CSS module declarations
declare module '*.css' {
  const content: string;
  export default content;
}

// markdown-it plugin type declarations
declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const footnote: (md: MarkdownIt) => void;
  export default footnote;
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';
  const taskLists: (md: MarkdownIt) => void;
  export default taskLists;
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it';
  export function full(md: MarkdownIt): void;
}
