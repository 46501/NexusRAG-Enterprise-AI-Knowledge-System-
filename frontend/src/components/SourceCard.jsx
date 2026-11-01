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
        background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
        borderRadius: 9999,
        boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        fontFamily: 'inherit',
      }}
      title={`Click to inspect passage from ${source.source}`}
    >
      <span className="text-[10px] font-bold opacity-75">
        [{source.index}]
      </span>
      {d && (
        <span
          className="text-[10px] font-medium px-1.5 py-px"
          style={{ background: d.bg, color: d.text, border: `1px solid ${d.border}`, borderRadius: 9999 }}
        >
          {source.department}
        </span>
      )}
      <span className="text-[11px] font-medium truncate max-w-[120px]" style={{ color: isDark ? 'rgba(255,255,255,0.80)' : '#334155' }}>
        {source.source}
      </span>
      {pct != null && (
        <span className="text-[11px] tabular-nums font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#64748b' }}>{pct}%</span>
      )}
    </button>
  )
}
