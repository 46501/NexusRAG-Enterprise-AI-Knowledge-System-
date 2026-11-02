import { useTheme } from '../context/ThemeContext'

const DEPT = {
  hr:          { bg: 'rgba(139,92,246,0.10)', text: '#a78bfa', border: 'rgba(139,92,246,0.20)' },
  engineering: { bg: 'rgba(14,165,233,0.10)',  text: '#38bdf8', border: 'rgba(14,165,233,0.20)' },
  finance:     { bg: 'rgba(16,185,129,0.10)',  text: '#34d399', border: 'rgba(16,185,129,0.20)' },
}

export default function SourceCard({ source, onClick }) {
  const { isDark } = useTheme()
  const pct = source.rerank_score != null ? Math.round(source.rerank_score) : null
  const d = DEPT[source.department]

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)'
          : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #cbd5e1',
        borderRadius: 9999,
        boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
        fontFamily: 'inherit',
      }}
      title={`Click to inspect passage from ${source.source}`}
    >
      <span className="text-[10px] font-semibold opacity-60">
        [{source.index}]
      </span>
      {d && (
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
          style={{ background: d.bg, color: d.text, border: `1px solid ${d.border}`, borderRadius: 9999 }}
        >
          {source.department}
        </span>
      )}
      <span className="text-[11px] font-medium truncate max-w-[130px]" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#334155' }}>
        {source.source}
      </span>
      {pct != null && (
        <span
          className="text-[10px] tabular-nums font-semibold px-1 rounded"
          style={{
            background: 'rgba(16,185,129,0.12)',
            color: '#10b981',
          }}
        >
          {pct}%
        </span>
      )}
    </button>
  )
}
