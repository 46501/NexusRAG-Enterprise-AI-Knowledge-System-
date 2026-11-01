import SourceCard from './SourceCard'

const DEPT_BG = {
  hr: '#7c3aed',
  engineering: '#0284c7',
  finance: '#059669',
}

function toBoldHtml(text) {
  const markers = (text.match(/\*\*/g) || []).length
  const cleaned = markers % 2 !== 0 ? text.replace(/\*\*(?=[^*]*$)/, '') : text
  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/gs, '<strong style="font-weight:600;color:rgba(255,255,255,0.95)">$1</strong>')
  return escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export default function MessageBubble({ role, content, userRole, sources, streaming }) {
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

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
      style={{ maxWidth: 700, width: '100%', animation: 'msgFadeIn 0.2s ease both' }}
    >
      <div
        className="max-w-[78%] text-sm"
        style={{
          padding: '18px 20px',
          lineHeight: 1.6,
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          ...(isUser
            ? { background: userBg, color: '#fff', whiteSpace: 'pre-wrap' }
            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.08)' })
        }}
      >
        {isUser
          ? content
          : <span dangerouslySetInnerHTML={{ __html: toBoldHtml(content) }} />
        }
      </div>
      {unique.length > 0 && (
        <div className="flex gap-1.5 flex-wrap max-w-[78%]">
          {unique.map((s) => <SourceCard key={s.source || s.chunk_id} source={s} />)}
        </div>
      )}
      <style>{`
        @keyframes msgFadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        .msg-body p:last-child { margin-bottom: 0 !important; }
      `}</style>
    </div>
  )
}
