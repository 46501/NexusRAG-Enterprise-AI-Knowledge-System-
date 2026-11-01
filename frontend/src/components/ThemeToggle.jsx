import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ className = '', style = {} }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0 ${
        isDark
          ? 'text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
      } ${className}`}
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
        boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        ...style,
      }}
    >
      {isDark ? (
        // Sun icon (click to switch to light mode)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200 hover:rotate-45"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon (click to switch to dark mode)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200 hover:-rotate-12"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  )
}

