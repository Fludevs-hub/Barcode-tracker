import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className={`btn text-[13px] ${className}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
