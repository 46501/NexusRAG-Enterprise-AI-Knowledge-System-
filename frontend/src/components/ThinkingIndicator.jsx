import { useTheme } from '../context/ThemeContext'

export default function ThinkingIndicator() {
  const { isDark } = useTheme()

  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 px-3.5 py-2.5"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
          borderRadius: '4px 16px 16px 16px',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8', animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
