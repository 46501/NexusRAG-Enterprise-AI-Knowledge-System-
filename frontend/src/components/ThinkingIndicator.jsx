import { useTheme } from '../context/ThemeContext'

export default function ThinkingIndicator() {
  const { isDark } = useTheme()

  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1.5 px-4 py-3"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.03) 100%)'
            : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid #e2e8f0',
          borderRadius: '18px 18px 18px 4px',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: isDark ? 'rgba(255,255,255,0.40)' : '#94a3b8', animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
