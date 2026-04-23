import { useMemo } from 'react';
import { useNoteStore } from '@/stores/noteStore';

function countWords(text: string): { chars: number; words: number; readingTime: string } {
  if (!text) return { chars: 0, words: 0, readingTime: '0 分钟' };

  // Strip frontmatter
  const fmEnd = text.indexOf('---', 3);
  const body = fmEnd >= 0 ? text.slice(fmEnd + 3) : text;

  // Count Chinese characters
  const cjk = body.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const cjkCount = cjk ? cjk.length : 0;

  // Count English words (non-CJK words)
  const englishText = body.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const englishWords = englishText.split(/\s+/).filter((w) => w.length > 0);
  const englishCount = englishWords.length;

  const totalWords = cjkCount + englishCount;
  const minutes = Math.max(1, Math.ceil(totalWords / 300));

  return {
    chars: body.replace(/\s/g, '').length,
    words: totalWords,
    readingTime: totalWords === 0 ? '0 分钟' : `约 ${minutes} 分钟`,
  };
}

export function StatusBar() {
  const papers = useNoteStore((s) => s.papers);
  const currentContent = useNoteStore((s) => s.currentContent);
  const currentPaper = useNoteStore((s) => s.currentPaper);

  const stats = useMemo(() => countWords(currentContent), [currentContent]);

  return (
    <div className="status-bar">
      <span>总计: {papers.length} 篇笔记</span>
      {currentPaper && (
        <>
          <span className="status-divider">|</span>
          <span>{stats.words} 字</span>
          <span>{stats.readingTime}</span>
        </>
      )}
      <span className="spacer" />
      {currentPaper && (
        <span>最后修改: {new Date(currentPaper.updatedDate).toLocaleString('zh-CN')}</span>
      )}
    </div>
  );
}
