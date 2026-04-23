import { useTagStore } from '@/stores/tagStore';

export function TagList() {
  const tags = useTagStore((s) => s.tags);
  const selectedTags = useTagStore((s) => s.selectedTags);
  const toggleTag = useTagStore((s) => s.toggleTag);

  if (tags.length === 0) return null;

  return (
    <div className="tag-list">
      <div className="section-label">标签</div>
      <div className="tags">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.name);
          return (
            <button
              key={tag.id}
              className={`tag-chip${isSelected ? ' selected' : ''}`}
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
