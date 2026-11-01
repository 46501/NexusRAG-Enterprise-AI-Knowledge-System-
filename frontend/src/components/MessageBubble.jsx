import SourceCard from './SourceCard'
import { useTheme } from '../context/ThemeContext'

const DEPT_BG = {
  hr: '#7c3aed',
  engineering: '#0284c7',
  finance: '#059669',
}

function toBoldHtml(text, isDark) {
  const markers = (text.match(/\*\*/g) || []).length
  const cleaned = markers % 2 !== 0 ? text.replace(/\*\*(?=[^*]*$)/, '') : text
  const strongColor = isDark ? 'rgba(255,255,255,0.95)' : '#020617'
  const citationBg = isDark ? 'rgba(139,92,246,0.20)' : '#ede9fe'
  const citationColor = isDark ? '#c4b5fd' : '#6d28d9'
  const citationBorder = isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe'

  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/gs, `<strong style="font-weight:600;color:${strongColor}">$1</strong>`)
    .replace(/\[(\d+)\]/g, `<button type="button" data-citation="$1" class="citation-chip cursor-pointer" title="Inspect source [$1]" style="display:inline-flex;align-items:center;justify-content:center;padding:1px 6px;margin:0 2px;font-size:11px;font-weight:700;line-height:1.2;border-radius:6px;background:${citationBg};color:${citationColor};border:1px solid ${citationBorder};vertical-align:baseline;transition:transform 0.15s ease;">[$1]</button>`)

  return escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export default function MessageBubble({ role, content, userRole, sources, streaming, onOpenCitation }) {
  const { isDark } = useTheme()
  const isUser = role === 'user'
  const userBg = DEPT_BG[userRole] ?? '#374151'

  const unique = !isUser && sources && sources.length > 0
    ? Array.from(
        sources.reduce((map, s) => {
          const key = s.source || 'unknown'
          if (!map.has(key) || (s.rerank_score ?? 0) > (map.get(key).rerank_score ?? 0)) {
            map.set(key, s)
          }
          return map
        }, new Map()).values()
      ).filter((s) => (s.rerank_score ?? 0) >= 5)
    : []

  function handleContentClick(e) {
    const btn = e.target.closest('[data-citation]')
    if (btn && onOpenCitation) {
      const idx = Number(btn.getAttribute('data-citation'))
      if (!isNaN(idx)) {
        onOpenCitation(idx, sources)
      }
    }
  }

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
      style={{ maxWidth: 700, width: '100%', animation: 'msgFadeIn 0.2s ease both' }}
    >
      <div
        onClick={handleContentClick}
        className="max-w-[78%] text-sm"
        style={{
          padding: '18px 20px',
          lineHeight: 1.6,
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          ...(isUser
            ? { background: userBg, color: '#fff', whiteSpace: 'pre-wrap' }
            : {
                background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#0f172a',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
              })
        }}
      >
        {isUser
          ? content
          : <span dangerouslySetInnerHTML={{ __html: toBoldHtml(content, isDark) }} />
        }
      </div>
      {unique.length > 0 && (
        <div className="flex gap-1.5 flex-wrap max-w-[78%] items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider mr-1 opacity-50">
            Sources:
          </span>
          {unique.map((s) => (
            <SourceCard
              key={s.chunk_id || s.index}
              source={s}
              onClick={() => onOpenCitation && onOpenCitation(s.index, sources)}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes msgFadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        .msg-body p:last-child { margin-bottom: 0 !important; }
        .citation-chip:hover { transform: scale(1.08); filter: brightness(1.1); }
      `}</style>
    </div>
  )
}
