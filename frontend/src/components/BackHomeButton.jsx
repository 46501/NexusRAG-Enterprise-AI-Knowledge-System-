import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

export default function BackHomeButton({ className = '' }) {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      title="Back to Home"
      aria-label="Back to Home"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0 ${
        isDark
          ? 'text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
      } ${className}`}
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1',
        boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  )
}

