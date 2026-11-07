import { useState, useEffect, useRef, useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'
import { getDocumentContent } from '../services/documents'
import PdfViewer from './PdfViewer'

const DEPT = {
  hr:          { dot: '#a78bfa', text: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)', label: 'Human Resources' },
  engineering: { dot: '#38bdf8', text: '#38bdf8', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.28)', label: 'Engineering' },
  finance:     { dot: '#34d399', text: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)', label: 'Finance' },
}

export default function DocumentReaderModal({
  isOpen,
  onClose,
  docIdOrName,
  highlightChunkIndex = null,
  highlightChunkId = null,
  highlightSnippet = '',
  onAskQuestion,
  onFocusDoc,
  onCompareDoc,
  onAuditDoc,
}) {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('chunks') // 'chunks' | 'fulltext' | 'pdf'
  const [searchQuery, setSearchQuery] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedChunkIdx, setCopiedChunkIdx] = useState(null)

  const chunkRefs = useRef({})
  const searchInputRef = useRef(null)

  // Defensively resolve document identifier whether string or object
  const resolvedDocIdOrName = useMemo(() => {
    if (!docIdOrName) return ''
    if (typeof docIdOrName === 'string') return docIdOrName
    if (typeof docIdOrName === 'object') {
      return (
        docIdOrName.doc_id ||
        docIdOrName.id ||
        docIdOrName.name ||
        docIdOrName.filename ||
        docIdOrName.file_name ||
        docIdOrName.source ||
        ''
      )
    }
    return String(docIdOrName)
  }, [docIdOrName])

  // Detect if the active document is a PDF
  const isPdf = useMemo(() => {
    const raw = (
      data?.document?.name ||
      (typeof docIdOrName === 'string' ? docIdOrName : docIdOrName?.name || docIdOrName?.filename) ||
      ''
    ).toLowerCase()
    return raw.endsWith('.pdf') || Boolean(data?.document?.is_pdf)
  }, [data, docIdOrName])

  // Fetch document content when modal opens or document changes
  useEffect(() => {
    if (!isOpen || !resolvedDocIdOrName) {
      setData(null)
      setError(null)
      return
    }

    let isCancelled = false
    setLoading(true)
    setError(null)

    getDocumentContent(resolvedDocIdOrName)
      .then((res) => {
        if (!isCancelled) {
          setData(res)
          const isPdfDoc =
            res?.document?.name?.toLowerCase()?.endsWith('.pdf') ||
            Boolean(res?.document?.is_pdf) ||
            (typeof docIdOrName === 'string' && docIdOrName.toLowerCase().endsWith('.pdf'))
          if (isPdfDoc && highlightChunkIndex == null && !highlightChunkId && !highlightSnippet) {
            setViewMode('pdf')
          } else {
            setViewMode('chunks')
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.response?.data?.detail || err.message || 'Failed to load document content.')
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isOpen, resolvedDocIdOrName])

  // Determine active highlighted chunk index
  const activeHighlightIndex = useMemo(() => {
    if (highlightChunkIndex != null && !isNaN(Number(highlightChunkIndex))) {
      return Number(highlightChunkIndex)
    }
    if (!data?.chunks) return null
    if (highlightChunkId) {
      const found = data.chunks.findIndex((c) => c.chunk_id === highlightChunkId)
      if (found !== -1) return data.chunks[found].chunk_index
    }
    if (highlightSnippet && typeof highlightSnippet === 'string') {
      const snipLower = highlightSnippet.slice(0, 40).toLowerCase()
      const found = data.chunks.findIndex((c) => c.text?.toLowerCase().includes(snipLower))
      if (found !== -1) return data.chunks[found].chunk_index
    }
    return null
  }, [highlightChunkIndex, highlightChunkId, highlightSnippet, data])

  // Auto-scroll to highlighted chunk when data loads
  useEffect(() => {
    if (!data || activeHighlightIndex == null || viewMode !== 'chunks') return
    const timer = setTimeout(() => {
      const el = chunkRefs.current[activeHighlightIndex]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [data, activeHighlightIndex, viewMode])

  // Keyboard shortcut listener: ESC to close, Ctrl/Cmd+F to focus search
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Filter chunks or text by search query (ALL HOOKS DECLARED UNCONDITIONALLY BEFORE ANY RETURN)
  const searchLower = searchQuery.trim().toLowerCase()
  const matchingChunkCount = useMemo(() => {
    if (!searchLower || !data?.chunks) return 0
    return data.chunks.filter((c) => c.text && c.text.toLowerCase().includes(searchLower)).length
  }, [searchLower, data])

  function handleCopyFullText() {
    if (!data?.full_text) return
    navigator.clipboard.writeText(data.full_text)
    setCopiedFull(true)
    setTimeout(() => setCopiedFull(false), 2000)
  }

  function handleCopyChunk(text, idx) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedChunkIdx(idx)
    setTimeout(() => setCopiedChunkIdx(null), 2000)
  }

  function handleAskAboutDoc() {
    const docName = data?.document?.name || resolvedDocIdOrName
    if (!docName) return
    onClose()
    if (onAskQuestion) {
      onAskQuestion(`What are the key policies and guidelines covered in ${docName}?`)
    }
  }

  function scrollToChunk(chunkIndex) {
    setViewMode('chunks')
    setTimeout(() => {
      chunkRefs.current[chunkIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  // Highlight matches in text
  function renderHighlightedText(text) {
    if (!text || typeof text !== 'string') return ''
    if (!searchLower) return text
    const parts = text.split(new RegExp(`(${searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === searchLower ? (
        <mark
          key={i}
          className="rounded px-0.5"
          style={{
            background: '#fef08a',
            color: '#854d0e',
            fontWeight: 600,
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  // React Rules of Hooks: conditional return must strictly be placed AFTER all hooks
  if (!isOpen) return null

  const doc = data?.document
  const deptKey = doc?.department || (typeof docIdOrName === 'object' ? docIdOrName?.department : null)
  const deptStyle = DEPT[deptKey] ?? {
    dot: '#a855f7',
    text: '#c084fc',
    bg: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.30)',
    label: deptKey || 'Enterprise',
  }
  const displayTitle = doc?.name || resolvedDocIdOrName || 'Document Reader'

  return (
    <div
      data-testid="document-reader-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 md:p-6 transition-all"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(14px)',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      {/* macOS Window Container */}
      <div
        className={`relative flex flex-col w-full transition-all duration-200 overflow-hidden ${
          isFullscreen
            ? 'h-[96vh] max-w-[98vw] rounded-2xl'
            : 'max-w-4xl h-[88vh] rounded-2xl'
        }`}
        style={{
          background: isDark ? 'rgba(18, 20, 29, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(32px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
          boxShadow: isDark
            ? '0 32px 72px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 32px 72px -12px rgba(15,23,42,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar (macOS Sonoma / Sequoia Style) */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b select-none shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            background: isDark ? 'rgba(24, 27, 40, 0.85)' : 'rgba(248, 250, 252, 0.90)',
          }}
        >
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-transform hover:scale-110 group cursor-pointer"
              style={{ background: '#ff5f57' }}
              title="Close window (Esc)"
            >
              <span className="text-[8px] text-[#4a0000] font-black opacity-0 group-hover:opacity-100">✕</span>
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-transform hover:scale-110 group cursor-pointer"
              style={{ background: '#febc2e' }}
              title="Standard size"
            >
              <span className="text-[8px] text-[#4a3400] font-black opacity-0 group-hover:opacity-100">−</span>
            </button>
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-transform hover:scale-110 group cursor-pointer"
              style={{ background: '#28c840' }}
              title="Toggle full size"
            >
              <span className="text-[8px] text-[#003800] font-black opacity-0 group-hover:opacity-100">+</span>
            </button>

            {/* Department Tag */}
            {(doc?.department || deptKey) && (
              <div
                className="ml-3 hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  background: deptStyle.bg,
                  color: deptStyle.text,
                  border: `1px solid ${deptStyle.border}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: deptStyle.dot }} />
                <span>{deptStyle.label}</span>
              </div>
            )}
          </div>

          {/* Window Center Title */}
          <div className="flex items-center gap-2 max-w-[50%] min-w-0">
            <span className="text-sm">📄</span>
            <span
              className="text-xs sm:text-sm font-semibold truncate tracking-tight"
              style={{ color: isDark ? '#ffffff' : '#0f172a' }}
              title={displayTitle}
            >
              {displayTitle}
            </span>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {onFocusDoc && (
              <button
                onClick={() => {
                  onFocusDoc(doc || { name: displayTitle })
                  onClose()
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: isDark ? 'rgba(168,85,247,0.22)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168,85,247,0.40)' : '1px solid #d8b4fe',
                }}
                title="Scope all chat questions specifically to this document"
              >
                <span>🎯</span>
                <span>Focus Q&A</span>
              </button>
            )}

            {onCompareDoc && (
              <button
                type="button"
                onClick={() => {
                  onCompareDoc(doc || { id: resolvedDocIdOrName, name: displayTitle })
                  onClose()
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: isDark ? 'rgba(56, 189, 248, 0.18)' : '#f0f9ff',
                  color: isDark ? '#38bdf8' : '#0284c7',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #bae6fd',
                }}
                title="Compare this document side-by-side with another file"
              >
                <span>📊</span>
                <span>Compare</span>
              </button>
            )}

            {onAuditDoc && (
              <button
                type="button"
                onClick={() => {
                  onAuditDoc({ focusDoc: displayTitle, persona: 'auditor' })
                  onClose()
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: isDark ? 'rgba(168, 85, 247, 0.22)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid #d8b4fe',
                }}
                title="Launch autonomous compliance audit on this policy"
              >
                <span>🤖</span>
                <span>Audit</span>
              </button>
            )}

            <button
              onClick={handleAskAboutDoc}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(124,58,237,0.08)',
                color: isDark ? '#c084fc' : '#7c3aed',
                border: isDark ? '1px solid rgba(168,85,247,0.30)' : '1px solid rgba(124,58,237,0.20)',
              }}
              title="Ask NexusRAG a question about this document"
            >
              <span>✨</span>
              <span>Ask in Chat</span>
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer"
              style={{
                color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sub-header Toolbar: Search + View Modes + Jump To Chunk */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-b shrink-0 text-xs"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
            background: isDark ? 'rgba(15, 17, 26, 0.70)' : 'rgba(241, 245, 249, 0.70)',
          }}
        >
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
              style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}
            >
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in document... (⌘F)"
              className="w-full pl-8 pr-7 py-1 rounded-lg text-xs outline-none transition-colors"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] cursor-pointer"
                style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#94a3b8' }}
              >
                ✕
              </button>
            )}
          </div>

          {searchLower && (
            <span className="text-[11px] font-medium" style={{ color: isDark ? '#c084fc' : '#7c3aed' }}>
              {matchingChunkCount} {matchingChunkCount === 1 ? 'chunk match' : 'chunk matches'}
            </span>
          )}

          {/* View Mode Toggle & Chunk Jump */}
          <div className="flex items-center gap-2">
            {/* View Mode Segmented Control */}
            <div
              className="flex items-center p-0.5 rounded-lg border text-xs"
              style={{
                background: isDark ? 'rgba(0,0,0,0.30)' : '#e2e8f0',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1',
              }}
            >
              {isPdf && (
                <button
                  data-testid="btn-pdf-view"
                  onClick={() => setViewMode('pdf')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                  style={{
                    background: viewMode === 'pdf'
                      ? (isDark ? 'rgba(255,255,255,0.15)' : '#ffffff')
                      : 'transparent',
                    color: viewMode === 'pdf'
                      ? (isDark ? '#38bdf8' : '#0284c7')
                      : (isDark ? 'rgba(255,255,255,0.45)' : '#64748b'),
                    boxShadow: viewMode === 'pdf' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  }}
                >
                  <span>📕</span>
                  <span>PDF View</span>
                </button>
              )}
              <button
                data-testid="btn-chunk-view"
                onClick={() => setViewMode('chunks')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
                style={{
                  background: viewMode === 'chunks'
                    ? (isDark ? 'rgba(255,255,255,0.15)' : '#ffffff')
                    : 'transparent',
                  color: viewMode === 'chunks'
                    ? (isDark ? '#fff' : '#0f172a')
                    : (isDark ? 'rgba(255,255,255,0.45)' : '#64748b'),
                  boxShadow: viewMode === 'chunks' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                <span>📑</span>
                <span>Chunk View ({data?.chunks?.length ?? '…'})</span>
              </button>
              <button
                data-testid="btn-continuous-text"
                onClick={() => setViewMode('fulltext')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
                style={{
                  background: viewMode === 'fulltext'
                    ? (isDark ? 'rgba(255,255,255,0.15)' : '#ffffff')
                    : 'transparent',
                  color: viewMode === 'fulltext'
                    ? (isDark ? '#fff' : '#0f172a')
                    : (isDark ? 'rgba(255,255,255,0.45)' : '#64748b'),
                  boxShadow: viewMode === 'fulltext' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                <span>📝</span>
                <span>Continuous Text</span>
              </button>
            </div>

            {/* Chunk Jump Selector */}
            {data?.chunks && data.chunks.length > 1 && (
              <select
                onChange={(e) => scrollToChunk(Number(e.target.value))}
                value={activeHighlightIndex ?? 0}
                className="px-2 py-1 rounded-lg text-[11px] font-medium outline-none cursor-pointer border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
                  color: isDark ? 'rgba(255,255,255,0.80)' : '#334155',
                }}
              >
                {data.chunks.map((c) => (
                  <option key={c.chunk_id || c.chunk_index} value={c.chunk_index}>
                    Chunk {c.chunk_index + 1} {c.chunk_index === activeHighlightIndex ? '★ Cited' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Copy Full Document Button */}
            <button
              onClick={handleCopyFullText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border"
              style={{
                background: copiedFull
                  ? (isDark ? 'rgba(52,211,153,0.15)' : '#dcfce7')
                  : (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'),
                borderColor: copiedFull
                  ? (isDark ? 'rgba(52,211,153,0.40)' : '#86efac')
                  : (isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'),
                color: copiedFull
                  ? (isDark ? '#34d399' : '#15803d')
                  : (isDark ? 'rgba(255,255,255,0.75)' : '#475569'),
              }}
              title="Copy entire document text to clipboard"
            >
              <span>{copiedFull ? '✓' : '📋'}</span>
              <span>{copiedFull ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className={`flex-1 ${viewMode === 'pdf' ? 'overflow-hidden p-2 sm:p-4 flex flex-col' : 'overflow-y-auto p-4 sm:p-6 space-y-4'}`}>
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div
                className={`w-9 h-9 rounded-full border-2 border-t-transparent animate-spin ${
                  isDark ? 'border-purple-400 border-t-white' : 'border-purple-600 border-t-purple-200'
                }`}
              />
              <p className="text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                Fetching document content: <span className="font-mono text-purple-400">{displayTitle}</span>
              </p>
              <p className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
                Verifying permissions and loading indexed vector chunks...
              </p>
            </div>
          )}

          {error && (
            <div
              className="p-5 rounded-2xl border text-xs sm:text-sm flex flex-col gap-3"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.20)',
                color: isDark ? '#fca5a5' : '#b91c1c',
              }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-base">⚠️</span>
                <span>Unable to load document content</span>
              </div>
              <div className="text-xs opacity-90 leading-relaxed font-mono p-2.5 rounded-lg bg-black/10 dark:bg-black/30">
                {error}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    if (resolvedDocIdOrName) {
                      setLoading(true)
                      setError(null)
                      getDocumentContent(resolvedDocIdOrName)
                        .then((res) => setData(res))
                        .catch((err) => setError(err.response?.data?.detail || err.message || 'Failed to load document content.'))
                        .finally(() => setLoading(false))
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2',
                    color: isDark ? '#fca5a5' : '#991b1b',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  🔄 Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                    color: isDark ? '#ffffff' : '#334155',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !data && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="text-3xl">📄</div>
              <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }}>
                No document data available.
              </p>
              <p className="text-xs max-w-sm" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}>
                The document "{displayTitle}" could not be retrieved or has no content.
              </p>
            </div>
          )}

          {!loading && !error && data && viewMode === 'pdf' && (
            <PdfViewer
              docIdOrName={resolvedDocIdOrName}
              filename={displayTitle}
              isDark={isDark}
              onFallbackToChunks={() => setViewMode('chunks')}
            />
          )}

          {!loading && !error && data && viewMode === 'chunks' && (!data.chunks || data.chunks.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="text-3xl">📑</div>
              <p className="text-sm font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#1e293b' }}>
                No discrete chunks found for this document.
              </p>
              <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
                You can switch to continuous text view to read the full document content.
              </p>
              <button
                onClick={() => setViewMode('fulltext')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: isDark ? 'rgba(168,85,247,0.2)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168,85,247,0.35)' : '1px solid #d8b4fe',
                }}
              >
                Switch to Continuous Text View ↗
              </button>
            </div>
          )}

          {!loading && !error && data && viewMode === 'chunks' && data.chunks?.length > 0 && (
            <div data-testid="reader-chunks-view" className="space-y-4">
              {data.chunks.map((chunk) => {
                const isTargetHighlight = chunk.chunk_index === activeHighlightIndex
                const hasSearchMatch = searchLower && chunk.text && chunk.text.toLowerCase().includes(searchLower)
                const isCopied = copiedChunkIdx === chunk.chunk_index

                return (
                  <div
                    key={chunk.chunk_id || chunk.chunk_index}
                    ref={(el) => (chunkRefs.current[chunk.chunk_index] = el)}
                    className="p-4 rounded-xl border transition-all duration-300 relative group"
                    style={{
                      background: isTargetHighlight
                        ? (isDark ? 'rgba(168, 85, 247, 0.10)' : 'rgba(243, 232, 255, 0.60)')
                        : hasSearchMatch
                        ? (isDark ? 'rgba(254, 240, 138, 0.06)' : 'rgba(254, 249, 195, 0.40)')
                        : (isDark ? 'rgba(255, 255, 255, 0.025)' : '#ffffff'),
                      borderColor: isTargetHighlight
                        ? (isDark ? '#a855f7' : '#9333ea')
                        : hasSearchMatch
                        ? (isDark ? '#eab308' : '#ca8a04')
                        : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
                      boxShadow: isTargetHighlight
                        ? (isDark ? '0 0 20px rgba(168,85,247,0.22)' : '0 4px 16px rgba(147,51,234,0.12)')
                        : 'none',
                    }}
                  >
                    {/* Chunk Card Header */}
                    <div
                      className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase font-mono"
                          style={{
                            background: isTargetHighlight
                              ? (isDark ? '#7c3aed' : '#9333ea')
                              : (isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'),
                            color: isTargetHighlight ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.70)' : '#475569'),
                          }}
                        >
                          Chunk {chunk.chunk_index + 1} of {data.chunks.length}
                        </span>

                        {isTargetHighlight && (
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              background: isDark ? 'rgba(168,85,247,0.25)' : '#f3e8ff',
                              color: isDark ? '#d8b4fe' : '#7e22ce',
                              border: isDark ? '1px solid rgba(168,85,247,0.40)' : '1px solid #d8b4fe',
                            }}
                          >
                            <span>🎯</span>
                            <span>Cited Source Chunk</span>
                          </span>
                        )}

                        {chunk.chunk_id && (
                          <span className="hidden md:inline font-mono text-[9px]" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }}>
                            ID: {chunk.chunk_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleCopyChunk(chunk.text, chunk.chunk_index)}
                        className="text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer"
                        style={{
                          background: isCopied
                            ? (isDark ? 'rgba(52,211,153,0.15)' : '#dcfce7')
                            : (isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                          color: isCopied
                            ? (isDark ? '#34d399' : '#15803d')
                            : (isDark ? 'rgba(255,255,255,0.45)' : '#64748b'),
                          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                        }}
                      >
                        {isCopied ? '✓ Copied' : 'Copy chunk'}
                      </button>
                    </div>

                    {/* Chunk Text */}
                    <div
                      className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap select-text font-normal"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.88)' : '#1e293b',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        lineHeight: 1.7,
                      }}
                    >
                      {renderHighlightedText(chunk.text)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !error && data && viewMode === 'fulltext' && (
            <div
              data-testid="reader-fulltext-view"
              className="p-5 sm:p-7 rounded-xl border text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap select-text transition-colors"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#1e293b',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                lineHeight: 1.8,
              }}
            >
              {renderHighlightedText(data.full_text || 'No full text available.')}
            </div>
          )}
        </div>

        {/* macOS Bottom Status Bar */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t shrink-0 text-[11px]"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            background: isDark ? 'rgba(15, 17, 26, 0.85)' : 'rgba(248, 250, 252, 0.90)',
            color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8',
          }}
        >
          <div className="flex items-center gap-3">
            {viewMode === 'pdf' && isPdf && (
              <>
                <span className="font-semibold text-sky-400 flex items-center gap-1">
                  <span>📕</span>
                  <span>PDF Document Mode</span>
                </span>
                <span>·</span>
              </>
            )}
            <span>
              {data?.chunks ? `${data.chunks.length} Vector Chunks` : 'Loading…'}
            </span>
            <span>·</span>
            <span>
              {data?.full_text ? `${(data.full_text.length / 1024).toFixed(1)} KB` : '0 KB'}
            </span>
            {activeHighlightIndex != null && (
              <>
                <span>·</span>
                <span style={{ color: isDark ? '#c084fc' : '#7c3aed' }}>
                  Targeting Chunk {activeHighlightIndex + 1}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px]">Esc</kbd> to exit</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
