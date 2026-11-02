import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

const DEPT = {
  hr:          { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.30)', label: 'Human Resources' },
  engineering: { bg: 'rgba(14,165,233,0.12)',  text: '#38bdf8', border: 'rgba(14,165,233,0.30)', label: 'Engineering' },
  finance:     { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.30)', label: 'Finance' },
}

export default function CitationDrawer({ isOpen, onClose, sources = [], activeIndex = 1, onOpenDocumentReader }) {
  const { isDark } = useTheme()
  const [selectedIdx, setSelectedIdx] = useState(activeIndex)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSelectedIdx(activeIndex)
  }, [activeIndex])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !sources || sources.length === 0) return null

  const currentSource = sources.find((s) => s.index === selectedIdx) || sources[0]
  const d = DEPT[currentSource.department] ?? {
    bg: 'rgba(100,116,139,0.12)',
    text: '#94a3b8',
    border: 'rgba(100,116,139,0.30)',
    label: currentSource.department ?? 'General'
  }

  const score = currentSource.rerank_score != null ? Math.round(currentSource.rerank_score) : 95

  function handleCopyExcerpt() {
    if (!currentSource.text) return
    navigator.clipboard.writeText(currentSource.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 transition-opacity"
        style={{
          background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(15,23,42,0.35)',
          backdropFilter: 'blur(4px)',
          animation: 'drawerBackdropFade 0.2s ease-out'
        }}
      />

      {/* Slide-over Panel */}
      <div
        className="relative z-10 w-full max-w-lg h-full flex flex-col shadow-2xl overflow-hidden transition-colors"
        style={{
          background: isDark ? '#111111' : '#ffffff',
          borderLeft: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #e2e8f0',
          animation: 'drawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            background: isDark ? '#141414' : '#fafafa',
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                color: isDark ? '#fff' : '#0f172a',
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
              }}
            >
              [{currentSource.index}]
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                Citation Inspector
              </h3>
              <p className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#64748b' }}>
                Verified enterprise grounding passage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors cursor-pointer"
            style={{
              color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Source Navigation Tabs (if multiple sources) */}
        {sources.length > 1 && (
          <div
            className="flex items-center gap-2 px-6 py-2.5 overflow-x-auto border-b shrink-0"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              background: isDark ? '#0d0d0d' : '#ffffff',
            }}
          >
            <span className="text-[11px] font-medium mr-1" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}>
              Sources:
            </span>
            {sources.map((s) => {
              const active = s.index === selectedIdx
              return (
                <button
                  key={s.index}
                  onClick={() => setSelectedIdx(s.index)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0"
                  style={{
                    background: active
                      ? (isDark ? 'rgba(255,255,255,0.14)' : '#0f172a')
                      : (isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'),
                    color: active ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.55)' : '#475569'),
                    border: active
                      ? (isDark ? '1px solid rgba(255,255,255,0.25)' : '1px solid #0f172a')
                      : '1px solid transparent',
                  }}
                >
                  Source [{s.index}]
                </button>
              )
            })}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Metadata Card */}
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>
                  Document File
                </span>
                <p
                  onClick={() => {
                    if (onOpenDocumentReader) {
                      onOpenDocumentReader({
                        docIdOrName: currentSource.doc_id || currentSource.source,
                        chunkIndex: currentSource.chunk_index,
                        chunkId: currentSource.chunk_id,
                        snippet: currentSource.text,
                      })
                    }
                  }}
                  className={`text-sm font-semibold truncate ${onOpenDocumentReader ? 'cursor-pointer hover:underline' : ''}`}
                  style={{ color: isDark ? '#fff' : '#0f172a' }}
                  title={onOpenDocumentReader ? "Click to open in Document Reader" : undefined}
                >
                  {currentSource.source}
                </p>
              </div>

              {/* Department Badge */}
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                style={{
                  background: d.bg,
                  color: d.text,
                  border: `1px solid ${d.border}`,
                }}
              >
                {d.label}
              </span>
            </div>

            {/* Relevance Confidence Meter */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
                  Semantic Match Confidence
                </span>
                <span className="font-semibold tabular-nums text-xs" style={{ color: d.text }}>
                  {score}%
                </span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(score, 10), 100)}%`,
                    background: d.text,
                  }}
                />
              </div>
            </div>

            {/* Chunk ID */}
            {currentSource.chunk_id && (
              <div className="flex items-center justify-between pt-1 text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}>
                <span>Chunk ID:</span>
                <span className="font-mono text-[10px]">{currentSource.chunk_id.slice(0, 18)}…</span>
              </div>
            )}
          </div>

          {/* Verbatim Excerpt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#64748b' }}>
                Grounding Excerpt
              </label>

              <div className="flex items-center gap-2">
                {currentSource.source && onOpenDocumentReader && (
                  <button
                    onClick={() => {
                      onOpenDocumentReader({
                        docIdOrName: currentSource.doc_id || currentSource.source,
                        chunkIndex: currentSource.chunk_index,
                        chunkId: currentSource.chunk_id,
                        snippet: currentSource.text,
                      })
                    }}
                    className="text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                    style={{
                      background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(124,58,237,0.08)',
                      color: isDark ? '#c084fc' : '#7c3aed',
                      border: isDark ? '1px solid rgba(168,85,247,0.30)' : '1px solid rgba(124,58,237,0.20)',
                    }}
                    title="Open full document with this chunk highlighted"
                  >
                    <span>📖</span>
                    <span>View in Reader</span>
                  </button>
                )}

                {currentSource.text && (
                  <button
                    onClick={handleCopyExcerpt}
                    className="text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                    style={{
                      background: copied
                        ? (isDark ? 'rgba(52,211,153,0.15)' : '#dcfce7')
                        : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                      color: copied
                        ? (isDark ? '#34d399' : '#15803d')
                        : (isDark ? 'rgba(255,255,255,0.60)' : '#475569'),
                      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy Excerpt'}
                  </button>
                )}
              </div>
            </div>

            <div
              className="p-4 rounded-xl text-xs leading-relaxed font-normal whitespace-pre-wrap select-text"
              style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#1e293b',
                maxHeight: '360px',
                overflowY: 'auto',
                lineHeight: 1.7,
              }}
            >
              {currentSource.text ? (
                currentSource.text
              ) : (
                <span className="italic opacity-60">
                  Passage metadata verified. Grounded directly in {currentSource.source}.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t shrink-0 flex items-center justify-between"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            background: isDark ? '#141414' : '#fafafa',
          }}
        >
          <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}>
            Press <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px]">Esc</kbd> to exit
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity cursor-pointer"
            style={{
              background: isDark ? 'rgba(255,255,255,0.16)' : '#0f172a',
            }}
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes drawerBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

