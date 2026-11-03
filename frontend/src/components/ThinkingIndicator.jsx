import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

const DEPT_THEMES = {
  hr: {
    accent: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.25)',
    border: 'rgba(167, 139, 250, 0.35)',
    pillBg: 'rgba(139, 92, 246, 0.12)',
    name: 'Human Resources',
  },
  engineering: {
    accent: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.25)',
    border: 'rgba(56, 189, 248, 0.35)',
    pillBg: 'rgba(14, 165, 233, 0.12)',
    name: 'Engineering',
  },
  finance: {
    accent: '#34d399',
    glow: 'rgba(52, 211, 153, 0.25)',
    border: 'rgba(52, 211, 153, 0.35)',
    pillBg: 'rgba(16, 185, 129, 0.12)',
    name: 'Finance',
  },
}

export default function ThinkingIndicator({ userRole = 'hr', focusDoc = null }) {
  const { isDark } = useTheme()
  const [elapsed, setElapsed] = useState(0)

  const dept = DEPT_THEMES[userRole] ?? {
    accent: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.25)',
    border: 'rgba(167, 139, 250, 0.35)',
    pillBg: 'rgba(139, 92, 246, 0.12)',
    name: userRole || 'Department',
  }

  // Elapsed timer ticker for realistic pipeline feedback
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed((Date.now() - start) / 1000)
    }, 70)
    return () => clearInterval(timer)
  }, [])

  const focusName = focusDoc?.name || (typeof focusDoc === 'string' ? focusDoc : null)

  const STAGES = [
    {
      id: 'vector',
      icon: '⚡',
      shortLabel: 'Vector Search',
      title: 'Querying Qdrant Vector Index',
      desc: focusName
        ? `Filtering dense embeddings strictly to ${focusName}...`
        : `Searching dense vector space in ${dept.name} knowledge base...`,
      progress: 25,
      threshold: 0.9,
    },
    {
      id: 'rerank',
      icon: '🎯',
      shortLabel: 'Reranking Context',
      title: 'Cross-Encoder Context Reranking',
      desc: 'Scoring semantic relevance across top candidate document chunks...',
      progress: 55,
      threshold: 1.9,
    },
    {
      id: 'grounding',
      icon: '🛡️',
      shortLabel: 'Grounding Verification',
      title: 'Grounding & Citation Verification',
      desc: 'Filtering context citations and evaluating baseline confidence score...',
      progress: 80,
      threshold: 3.0,
    },
    {
      id: 'synthesis',
      icon: '✍️',
      shortLabel: 'Synthesis',
      title: 'Synthesizing Grounded Answer',
      desc: 'Formulating verifiable answer with interactive citation links...',
      progress: 95,
      threshold: Infinity,
    },
  ]

  // Calculate current stage index based on elapsed time
  let currentStageIndex = 0
  if (elapsed >= 3.0) {
    currentStageIndex = 3
  } else if (elapsed >= 1.9) {
    currentStageIndex = 2
  } else if (elapsed >= 0.9) {
    currentStageIndex = 1
  }

  const activeStage = STAGES[currentStageIndex]

  return (
    <div className="flex justify-start w-full my-1 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
      <div
        className={`w-full max-w-[620px] rounded-2xl border p-3.5 transition-all shadow-md backdrop-blur-xl ${
          isDark
            ? 'bg-[#12141c]/85 border-white/10 shadow-black/30 text-white'
            : 'bg-white/90 border-slate-200/90 shadow-slate-200/40 text-slate-900'
        }`}
        style={{
          boxShadow: isDark
            ? `0 10px 25px -5px rgba(0,0,0,0.5), 0 0 15px ${dept.glow}`
            : '0 8px 20px -4px rgba(15,23,42,0.06)',
        }}
      >
        {/* Header Row: Agent Status, Step Indicator & Timer */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Glowing Pulse Dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: dept.accent }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ backgroundColor: dept.accent }}
              />
            </span>

            <span className="text-[11px] font-semibold tracking-tight uppercase" style={{ color: dept.accent }}>
              NexusRAG Agent Active
            </span>

            {focusName && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[200px]"
                style={{
                  background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe',
                }}
                title={`Targeting: ${focusName}`}
              >
                🎯 {focusName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
            <span className="font-mono opacity-60">
              Step {currentStageIndex + 1}/4
            </span>
            <span
              className="font-mono font-medium px-1.5 py-0.5 rounded-md"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: isDark ? 'rgba(255,255,255,0.80)' : '#334155',
              }}
            >
              {elapsed.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Current Active Stage Presentation */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shadow-xs flex-shrink-0 mt-0.5"
            style={{
              background: dept.pillBg,
              border: `1px solid ${dept.border}`,
            }}
          >
            <span className="animate-pulse">{activeStage.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold leading-tight">
                {activeStage.title}
              </h4>
              <div className="flex items-center gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1 h-1 rounded-full animate-bounce"
                    style={{
                      backgroundColor: dept.accent,
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>

            <p
              className="text-[11px] leading-relaxed mt-0.5 truncate transition-all"
              style={{ color: isDark ? 'rgba(255,255,255,0.60)' : '#64748b' }}
              title={activeStage.desc}
            >
              {activeStage.desc}
            </p>
          </div>
        </div>

        {/* Dynamic Multi-Step Pipeline Stepper Bar */}
        <div className="space-y-1.5 pt-1">
          {/* Progress Track */}
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 relative">
            <div
              className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
              style={{
                width: `${activeStage.progress}%`,
                background: `linear-gradient(90deg, ${dept.accent}, #818cf8)`,
                boxShadow: `0 0 10px ${dept.accent}60`,
              }}
            >
              <div
                className="absolute inset-0 w-full h-full animate-[shimmer_1.5s_infinite]"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                }}
              />
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="grid grid-cols-4 gap-1 pt-0.5 text-center">
            {STAGES.map((s, idx) => {
              const isPast = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-center gap-1 py-0.5 px-1 rounded text-[9px] font-medium transition-all ${
                    isCurrent
                      ? isDark
                        ? 'bg-white/10 text-white font-semibold'
                        : 'bg-slate-200 text-slate-900 font-semibold'
                      : isPast
                      ? isDark
                        ? 'text-emerald-400 opacity-80'
                        : 'text-emerald-600 opacity-80'
                      : isDark
                      ? 'text-white/25'
                      : 'text-slate-400'
                  }`}
                >
                  <span>{isPast ? '✓' : isCurrent ? '●' : '○'}</span>
                  <span className="truncate hidden sm:inline">{s.shortLabel}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
