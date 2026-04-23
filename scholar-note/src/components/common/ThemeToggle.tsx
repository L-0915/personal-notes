import { useUiStore } from '@/stores/uiStore';

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`切换到${theme === 'light' ? '深色' : '浅色'}主题`}
      title={`切换到${theme === 'light' ? '深色' : '浅色'}主题`}
    >
      {theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
    </button>
  );
}
