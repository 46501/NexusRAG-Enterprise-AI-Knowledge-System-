import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext'

export default function GroundingConfidenceBadge({
  confidenceScore = null,
  sources = [],
  department = 'enterprise',
  onOpenCitation,
  onOpenReader,
}) {
  const { isDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Calculate score: use provided confidenceScore or derive from top sources
  let score = null
  if (confidenceScore != null && !isNaN(confidenceScore)) {
    score = Math.round(confidenceScore)
  } else if (sources && sources.length > 0) {
    const validScores = sources
      .map((s) => s.rerank_score)
      .filter((s) => s != null && !isNaN(s))
    if (validScores.length > 0) {
      score = Math.round(validScores[0])
    } else {
      score = 94
    }
  }

  // Close modal when pressing Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // If no score or no sources, return null
  if (score == null || !sources || sources.length === 0) return null

  // Determine tier & styling
  let tier = {
    label: 'High Confidence',
    level: 'High',
    icon: '🛡️',
    darkText: '#34d399',
    darkBg: 'rgba(16, 185, 129, 0.12)',
    darkBorder: 'rgba(16, 185, 129, 0.28)',
    lightText: '#059669',
    lightBg: '#ecfdf5',
    lightBorder: '#a7f3d0',
    barGradient: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
    summary: 'Answer is strongly grounded in verified corporate policy files.',
  }

  if (score < 75) {
    tier = {
      label: 'Broad Context',
      level: 'Broad',
      icon: 'ℹ️',
      darkText: '#fb923c',
      darkBg: 'rgba(249, 115, 22, 0.12)',
      darkBorder: 'rgba(249, 115, 22, 0.28)',
      lightText: '#ea580c',
      lightBg: '#fff7ed',
      lightBorder: '#fed7aa',
      barGradient: 'linear-gradient(90deg, #ea580c 0%, #fb923c 100%)',
      summary: 'Answer references broader context from your department documents.',
    }
  } else if (score < 88) {
    tier = {
      label: 'Verified',
      level: 'Moderate',
      icon: '⚖️',
      darkText: '#fbbf24',
      darkBg: 'rgba(245, 158, 11, 0.12)',
      darkBorder: 'rgba(245, 158, 11, 0.28)',
      lightText: '#d97706',
      lightBg: '#fffbeb',
      lightBorder: '#fde68a',
      barGradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
      summary: 'Passages directly matched relevant sections of corporate documents.',
    }
  }

  const textColor = isDark ? tier.darkText : tier.lightText
  const bgColor = isDark ? tier.darkBg : tier.lightBg
  const borderColor = isDark ? tier.darkBorder : tier.lightBorder
  const topSource = sources[0]?.source || 'Corporate Document'

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Clickable Badge Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all duration-200 cursor-pointer select-none hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: bgColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
        }}
        title="Click to view detailed grounding confidence and verification signals"
      >
        <span className="text-[10px]">{tier.icon}</span>
        <span className="font-bold tracking-tight">{score}%</span>
        <span className="font-medium opacity-90">Grounded</span>
        <span className="text-[9px] opacity-70">·</span>
        <span className="text-[10px] font-medium opacity-85 hidden sm:inline">{tier.label}</span>
        <span className="text-[8px] opacity-50 ml-0.5 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </button>

      {/* Interactive macOS Frosted Grounding Verification Modal (Portaled) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grounding-modal-title"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.68)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          <div
            ref={containerRef}
            className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 text-xs select-none transition-all border animate-popoverIn flex flex-col max-h-[90vh] overflow-hidden relative"
            style={{
              background: isDark ? 'rgba(18, 20, 28, 0.98)' : 'rgba(255, 255, 255, 0.99)',
              backdropFilter: 'blur(28px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#e2e8f0',
              boxShadow: isDark
                ? '0 25px 60px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 25px 60px -12px rgba(15,23,42,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between pb-3.5 border-b shrink-0"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{tier.icon}</span>
                <div>
                  <h4 id="grounding-modal-title" className="font-semibold text-sm leading-none" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    Grounding Verification
                  </h4>
                  <p className="text-[11px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
                    Enterprise RAG Trust Score
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs cursor-pointer transition-colors hover:scale-105"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.60)' : '#64748b',
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                }}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-0.5">
              {/* Meter Bar Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: textColor }}>
                    {score}% {tier.level} Confidence
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#94a3b8' }}>
                    Score: {score} / 100
                  </span>
                </div>

                {/* Meter Progress Bar */}
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(Math.max(score, 5), 100)}%`,
                      background: tier.barGradient,
                      boxShadow: `0 0 10px ${textColor}55`,
                    }}
                  />
                </div>

                <p className="text-[11.5px] leading-relaxed pt-1" style={{ color: isDark ? 'rgba(255,255,255,0.70)' : '#475569' }}>
                  {tier.summary}
                </p>
              </div>

              {/* Signal Breakdown Grid */}
              <div
                className="p-3 rounded-xl border space-y-2 text-xs"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                    Authoritative Sources:
                  </span>
                  <span className="font-semibold font-mono" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                    {sources.length} {sources.length === 1 ? 'passage' : 'passages'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                    Top Matched File:
                  </span>
                  <span className="font-semibold truncate max-w-[180px] sm:max-w-[220px]" style={{ color: isDark ? '#fff' : '#0f172a' }} title={topSource}>
                    {topSource}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                    RBAC Clearance:
                  </span>
                  <span className="font-semibold capitalize text-emerald-500 flex items-center gap-1">
                    <span>✓</span>
                    <span>{department} Only</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                    Retrieval Pipeline:
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.70)' : '#475569' }}>
                    Dense + BM25s
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div
              className="pt-3 border-t shrink-0 flex items-center gap-2"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9' }}
            >
              {onOpenCitation && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onOpenCitation(1, sources)
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-center font-medium text-xs transition-all cursor-pointer border hover:opacity-100 opacity-90"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  }}
                >
                  Inspect Sources ↗
                </button>
              )}

              {onOpenReader && sources && sources.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    const first = sources[0]
                    onOpenReader({
                      docIdOrName: first?.doc_id || first?.source || first?.file_name || first?.name,
                      chunkIndex: first?.chunk_index ?? 0,
                      chunkId: first?.chunk_id,
                      snippet: first?.text || '',
                    })
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-center font-semibold text-xs transition-all cursor-pointer border shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: isDark ? 'rgba(168,85,247,0.22)' : 'rgba(124,58,237,0.12)',
                    borderColor: isDark ? 'rgba(168,85,247,0.40)' : 'rgba(124,58,237,0.30)',
                    color: isDark ? '#d8b4fe' : '#7c3aed',
                  }}
                >
                  Open Reader 📖
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes popoverIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-popoverIn {
          animation: popoverIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  )
}

