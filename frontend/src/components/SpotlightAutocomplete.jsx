import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function SpotlightAutocomplete({
  isOpen,
  onClose,
  items = [],
  selectedIndex = 0,
  onSelect,
  inputQuery = '',
}) {
  const { isDark } = useTheme()
  const listRef = useRef(null)

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-selected="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen || items.length === 0) return null

  // Helper to highlight matching text
  function highlightMatch(text, query) {
    if (!query || !query.trim()) return text
    const cleanQ = query.trim().replace(/@/g, '')
    if (!cleanQ) return text

    const idx = text.toLowerCase().indexOf(cleanQ.toLowerCase())
    if (idx === -1) return text

    const start = text.slice(0, idx)
    const match = text.slice(idx, idx + cleanQ.length)
    const end = text.slice(idx + cleanQ.length)

    return (
      <>
        {start}
        <strong className="font-bold underline decoration-purple-400 decoration-1 underline-offset-2" style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}>
          {match}
        </strong>
        {end}
      </>
    )
  }

  return (
    <div
      className="absolute bottom-full mb-3 left-0 right-0 z-40 rounded-2xl overflow-hidden border shadow-2xl transition-all duration-150 animate-fadeIn select-none"
      style={{
        background: isDark ? 'rgba(16, 18, 26, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
        boxShadow: isDark
          ? '0 20px 48px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 20px 40px -8px rgba(15,23,42,0.14), 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header Bar */}
      <div
        className="px-4 py-2 border-b flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider select-none shrink-0"
        style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
          background: isDark ? 'rgba(24, 27, 40, 0.60)' : 'rgba(248, 250, 252, 0.80)',
          color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span>⚡</span>
          <span>Spotlight Autocomplete</span>
        </div>
        <span>{items.length} suggestions</span>
      </div>

      {/* Suggestion List */}
      <div
        ref={listRef}
        className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5 doc-scroll"
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex
          const isDoc = item.type === 'document'
          const isRecent = item.type === 'recent'

          return (
            <button
              key={item.id}
              type="button"
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => onSelect(item)}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                isSelected
                  ? isDark
                    ? 'bg-purple-500/20 border-purple-500/40 text-white shadow-xs'
                    : 'bg-purple-50 border-purple-200 text-purple-950 shadow-xs'
                  : isDark
                  ? 'border-transparent text-white/80 hover:bg-white/[0.04]'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-sm shrink-0">
                  {isDoc ? '📄' : isRecent ? '🕒' : '✨'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug truncate">
                    {highlightMatch(item.label, inputQuery)}
                  </p>
                  <p className="text-[10px] opacity-50 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isDoc && (
                  <span
                    className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded font-mono"
                    style={{
                      background: isDark ? 'rgba(56, 189, 248, 0.20)' : '#e0f2fe',
                      color: isDark ? '#38bdf8' : '#0284c7',
                    }}
                  >
                    @doc
                  </span>
                )}
                {isSelected && (
                  <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/15 dark:bg-white/15 opacity-70">
                    ↵
                  </kbd>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer Navigation Hints */}
      <div
        className="px-4 py-1.5 border-t flex items-center justify-between text-[10px] select-none shrink-0"
        style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
          background: isDark ? 'rgba(20, 23, 34, 0.40)' : 'rgba(248, 250, 252, 0.60)',
          color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8',
        }}
      >
        <div className="flex items-center gap-3">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">Tab</kbd> complete</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
        </div>
        <span><kbd className="font-mono">Esc</kbd> dismiss</span>
      </div>
    </div>
  )
}

