const DEPT = {
  hr:          { bg: 'rgba(139,92,246,0.10)', text: '#a78bfa', border: 'rgba(139,92,246,0.20)' },
  engineering: { bg: 'rgba(14,165,233,0.10)',  text: '#38bdf8', border: 'rgba(14,165,233,0.20)' },
  finance:     { bg: 'rgba(16,185,129,0.10)',  text: '#34d399', border: 'rgba(16,185,129,0.20)' },
}

export default function SourceCard({ source }) {
  const pct = source.rerank_score != null ? Math.round(source.rerank_score) : null
  const d = DEPT[source.department]

  return (
    <div
      className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9999 }}
    >
      {d && (
        <span
          className="text-[10px] font-medium px-1.5 py-px"
          style={{ background: d.bg, color: d.text, border: `1px solid ${d.border}`, borderRadius: 9999 }}
        >
          {source.department}
        </span>
      )}
      <span className="text-[11px] font-medium truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {source.source}
      </span>
      {pct != null && (
        <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.30)' }}>{pct}%</span>
      )}
    </div>
  )
}
