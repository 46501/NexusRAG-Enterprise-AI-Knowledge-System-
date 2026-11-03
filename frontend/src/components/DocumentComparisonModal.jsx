import { useState, useEffect, useMemo, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  COMPARISON_PRESETS,
  buildComparisonPrompt,
  runComparisonQuery,
  parseMarkdownTable,
  exportTableToCsv,
  copyMarkdownToClipboard,
} from '../services/comparison'
import { getDocumentContent } from '../services/documents'
import GroundingConfidenceBadge from './GroundingConfidenceBadge'

const DEPT_INFO = {
  hr:          { name: 'Human Resources', dot: '#a78bfa', text: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  engineering: { name: 'Engineering',     dot: '#38bdf8', text: '#38bdf8', bg: 'rgba(14,165,233,0.12)' },
  finance:     { name: 'Finance',         dot: '#34d399', text: '#34d399', bg: 'rgba(16,185,129,0.12)' },
}

export default function DocumentComparisonModal({
  isOpen,
  onClose,
  documents = [],
  userRole = 'engineering',
  initialDocA = null,
  initialDocB = null,
  onOpenDocumentReader,
  onOpenInChat,
}) {
  const { isDark } = useTheme()
  const [docAId, setDocAId] = useState('')
  const [docBId, setDocBId] = useState('')
  const [docCId, setDocCId] = useState('')
  const [showDocC, setShowDocC] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('comprehensive')
  const [customPrompt, setCustomPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('matrix') // 'matrix' | 'chunks' | 'raw'

  // Comparison State
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(1)
  const [comparisonResult, setComparisonResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Side-by-Side Raw Chunks State
  const [chunksLoading, setChunksLoading] = useState(false)
  const [chunksA, setChunksA] = useState([])
  const [chunksB, setChunksB] = useState([])
  const [searchChunkA, setSearchChunkA] = useState('')
  const [searchChunkB, setSearchChunkB] = useState('')

  const dept = DEPT_INFO[userRole] || DEPT_INFO.engineering

  // Pre-fill initial documents when opened
  useEffect(() => {
    if (isOpen) {
      if (initialDocA) {
        setDocAId(initialDocA.id || initialDocA)
      } else if (documents.length > 0 && !docAId) {
        setDocAId(documents[0].id)
      }

      if (initialDocB) {
        setDocBId(initialDocB.id || initialDocB)
      } else if (documents.length > 1 && !docBId) {
        setDocBId(documents[1].id)
      }
    }
  }, [isOpen, initialDocA, initialDocB, documents])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onClose])

  const docA = documents.find((d) => d.id === docAId)
  const docB = documents.find((d) => d.id === docBId)
  const docC = showDocC ? documents.find((d) => d.id === docCId) : null

  // Fetch raw chunks when Side-by-Side tab is activated
  useEffect(() => {
    if (activeTab === 'chunks' && docAId && docBId) {
      loadSideBySideChunks()
    }
  }, [activeTab, docAId, docBId])

  async function loadSideBySideChunks() {
    setChunksLoading(true)
    try {
      const [resA, resB] = await Promise.all([
        getDocumentContent(docAId),
        getDocumentContent(docBId),
      ])
      setChunksA(resA.chunks || [])
      setChunksB(resB.chunks || [])
    } catch (err) {
      console.error('Failed to load document chunks for comparison:', err)
    } finally {
      setChunksLoading(false)
    }
  }

  async function handleRunComparison() {
    if (!docA || !docB || loading) return

    setLoading(true)
    setError(null)
    setLoadingStep(1)
    setActiveTab('matrix')

    const timer1 = setTimeout(() => setLoadingStep(2), 1500)
    const timer2 = setTimeout(() => setLoadingStep(3), 3200)

    try {
      const docNames = [docA.name, docB.name]
      if (docC) docNames.push(docC.name)

      const prompt = buildComparisonPrompt(docNames, selectedPreset, customPrompt)
      const data = await runComparisonQuery({
        query: prompt,
        department: userRole,
        topK: 10,
      })

      setComparisonResult(data)
    } catch (err) {
      console.error('Comparison failed:', err)
      setError(err.response?.data?.detail || 'Failed to generate comparison. Please try another preset or documents.')
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setLoading(false)
    }
  }

  // Parse structured table from comparison result answer
  const parsedTable = useMemo(() => {
    if (!comparisonResult?.answer) return null
    return parseMarkdownTable(comparisonResult.answer)
  }, [comparisonResult])

  // Extract executive summary and recommendations
  const textSections = useMemo(() => {
    if (!comparisonResult?.answer) return { summary: '', diffs: '' }
    const text = comparisonResult.answer

    let summary = ''
    let diffs = ''

    if (text.includes('### Executive Summary')) {
      const parts = text.split('### Executive Summary')
      if (parts[1]) {
        const nextHeader = parts[1].search(/###\s+/i)
        summary = nextHeader !== -1 ? parts[1].slice(0, nextHeader).trim() : parts[1].trim()
      }
    }

    if (text.includes('### Key Differences') || text.includes('### Key Divergences') || text.includes('### Recommendations')) {
      const diffIdx = text.search(/###\s+(Key Differences|Key Divergences|Recommendations)/i)
      if (diffIdx !== -1) {
        diffs = text.slice(diffIdx).trim()
      }
    }

    return { summary, diffs }
  }, [comparisonResult])

  function handleCopyTable() {
    if (!comparisonResult?.answer) return
    copyMarkdownToClipboard(comparisonResult.answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadCsv() {
    if (!parsedTable) return
    const nameA = docA?.name?.replace(/\.[^/.]+$/, '') || 'docA'
    const nameB = docB?.name?.replace(/\.[^/.]+$/, '') || 'docB'
    exportTableToCsv(parsedTable.headers, parsedTable.rows, `comparison_${nameA}_vs_${nameB}.csv`)
  }

  function handleLaunchInChat() {
    if (!comparisonResult || !onOpenInChat) return
    const prompt = `Based on the comparison between ${docA?.name} and ${docB?.name}, what are the specific policy divergence points?`
    onOpenInChat(prompt, comparisonResult)
    onClose()
  }

  // Filter raw chunks
  const filteredChunksA = useMemo(() => {
    if (!searchChunkA.trim()) return chunksA
    const q = searchChunkA.toLowerCase()
    return chunksA.filter((c) => (c.text || '').toLowerCase().includes(q))
  }, [chunksA, searchChunkA])

  const filteredChunksB = useMemo(() => {
    if (!searchChunkB.trim()) return chunksB
    const q = searchChunkB.toLowerCase()
    return chunksB.filter((c) => (c.text || '').toLowerCase().includes(q))
  }, [chunksB, searchChunkB])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 select-none"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.78)' : 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(20px)',
      }}
      onClick={!loading ? onClose : undefined}
    >
      {/* macOS Window Frame */}
      <div
        className="relative flex flex-col w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl transition-all border"
        style={{
          background: isDark ? 'rgba(16, 18, 26, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(36px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
          boxShadow: isDark
            ? '0 32px 80px -16px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 32px 80px -16px rgba(15,23,42,0.22), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar (macOS Window Chrome) */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b select-none shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            background: isDark ? 'rgba(22, 25, 38, 0.85)' : 'rgba(248, 250, 252, 0.90)',
          }}
        >
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              onClick={!loading ? onClose : undefined}
              disabled={loading}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-transform hover:scale-110 group cursor-pointer disabled:opacity-40"
              style={{ background: '#ff5f57' }}
              title="Close window (Esc)"
            >
              <span className="text-[8px] text-[#4a0000] font-black opacity-0 group-hover:opacity-100">✕</span>
            </button>
            <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e', opacity: 0.8 }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28c840', opacity: 0.8 }} />

            <div className="ml-3 flex items-center gap-1.5 font-mono text-[11px] opacity-60">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dept.dot }} />
              <span className="uppercase font-semibold tracking-wider">{dept.name} Matrix</span>
            </div>
          </div>

          {/* Window Center Title */}
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>
            <span>📊</span>
            <span>Multi-Document Comparison Matrix</span>
          </div>

          {/* Close Button */}
          <button
            onClick={!loading ? onClose : undefined}
            disabled={loading}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-30"
            style={{
              color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
            }}
          >
            ✕
          </button>
        </div>

        {/* Document Selection & Comparison Control Bar */}
        <div
          className="p-4 border-b shrink-0 space-y-3"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
          }}
        >
          {/* Document Pickers Row */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            {/* Document A */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}>
                Document A:
              </label>
              <select
                value={docAId}
                onChange={(e) => setDocAId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-medium outline-none border cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.id === docBId || d.id === docCId}>
                    {d.name} ({d.chunk_count} chunks)
                  </option>
                ))}
              </select>
            </div>

            {/* VS Badge */}
            <div className="pt-4 shrink-0">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                  color: isDark ? '#d8b4fe' : '#7e22ce',
                  border: isDark ? '1px solid rgba(168, 85, 247, 0.30)' : '1px solid #d8b4fe',
                }}
              >
                vs
              </span>
            </div>

            {/* Document B */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                Document B:
              </label>
              <select
                value={docBId}
                onChange={(e) => setDocBId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 rounded-xl text-xs font-medium outline-none border cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.id === docAId || d.id === docCId}>
                    {d.name} ({d.chunk_count} chunks)
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Document C */}
            {showDocC && (
              <>
                <div className="pt-4 shrink-0">
                  <span className="text-[10px] opacity-40 font-bold">vs</span>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>
                      Document C:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDocC(false)}
                      className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <select
                    value={docCId}
                    onChange={(e) => setDocCId(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-medium outline-none border cursor-pointer"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
                      color: isDark ? '#ffffff' : '#0f172a',
                    }}
                  >
                    <option value="">-- Choose 3rd file --</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.id === docAId || d.id === docBId}>
                        {d.name} ({d.chunk_count} chunks)
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {!showDocC && documents.length > 2 && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDocC(true)
                    const available = documents.find((d) => d.id !== docAId && d.id !== docBId)
                    if (available) setDocCId(available.id)
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#cbd5e1',
                    color: isDark ? 'rgba(255,255,255,0.70)' : '#475569',
                  }}
                  title="Add a 3rd document to comparison"
                >
                  + 3rd Doc
                </button>
              </div>
            )}

            {/* Run Button */}
            <div className="pt-4 ml-auto">
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={!docA || !docB || loading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #38bdf8 100%)',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                }}
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 rounded-full border border-t-transparent border-white animate-spin" />
                    <span>Analyzing Chunks...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Generate Matrix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40 mr-1">
              Dimension Preset:
            </span>
            {COMPARISON_PRESETS.map((p) => {
              const active = selectedPreset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreset(p.id)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                    active
                      ? isDark
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                        : 'bg-purple-100 border-purple-300 text-purple-900 font-semibold'
                      : isDark
                      ? 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={p.description}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              )
            })}
          </div>

          {/* Custom Prompt Input if "Custom" preset is selected */}
          {selectedPreset === 'custom' && (
            <div className="pt-1">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Compare reimbursement limits, allowable meal expenses, and approval thresholds..."
                className="w-full px-3 py-1.5 rounded-xl text-xs outline-none border transition-colors"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
              />
            </div>
          )}
        </div>

        {/* View Tabs & Actions Bar */}
        <div
          className="px-5 py-2 border-b shrink-0 flex items-center justify-between"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
            background: isDark ? 'rgba(18, 20, 28, 0.30)' : '#f8fafc',
          }}
        >
          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? isDark ? 'bg-white/10 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              📊 AI Comparison Matrix
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chunks')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'chunks'
                  ? isDark ? 'bg-white/10 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              📑 Side-by-Side Chunks ({docA ? (docA.chunk_count || chunksA.length) : 0} vs {docB ? (docB.chunk_count || chunksB.length) : 0})
            </button>
            {comparisonResult && (
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'raw'
                    ? isDark ? 'bg-white/10 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                📝 Full Report
              </button>
            )}
          </div>

          {/* Right Action Buttons */}
          {comparisonResult && activeTab === 'matrix' && (
            <div className="flex items-center gap-2">
              <GroundingConfidenceBadge score={comparisonResult.confidence_score} />

              <button
                type="button"
                onClick={handleCopyTable}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
                title="Copy markdown table to clipboard"
              >
                {copied ? '✓ Copied' : '📋 Copy Table'}
              </button>

              {parsedTable && (
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  }}
                  title="Export structured matrix to Excel/CSV"
                >
                  📥 Export CSV
                </button>
              )}

              {onOpenInChat && (
                <button
                  type="button"
                  onClick={handleLaunchInChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-xs"
                  style={{
                    background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                    color: isDark ? '#d8b4fe' : '#7e22ce',
                    border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe',
                  }}
                  title="Ask follow-up questions in chat thread"
                >
                  <span>💬</span>
                  <span>Ask in Chat</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 doc-scroll">
          {/* Loading Stepper View */}
          {loading && (
            <div className="h-full flex flex-col items-center justify-center p-8 space-y-5 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xl animate-bounce"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)', color: '#fff' }}
              >
                📊
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                  Synthesizing Multi-Document Comparison
                </h3>
                <p className="text-xs max-w-md opacity-60">
                  Cross-referencing indexed BGE vector embeddings and BM25 keywords between {docA?.name} and {docB?.name}...
                </p>
              </div>

              {/* Progress Pipeline */}
              <div
                className="w-full max-w-md p-4 rounded-xl border space-y-3"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-2" style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                    {loadingStep === 1 && 'Scanning hybrid vector & BM25 indices...'}
                    {loadingStep === 2 && 'Aligning comparative dimensions & clauses...'}
                    {loadingStep === 3 && 'Synthesizing matrix & grounding citations...'}
                  </span>
                  <span className="font-mono text-[10px] opacity-60">Step {loadingStep} of 3</span>
                </div>

                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${loadingStep === 1 ? 33 : loadingStep === 2 ? 70 : 100}%`,
                      background: 'linear-gradient(90deg, #7c3aed 0%, #38bdf8 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div
              className="p-4 rounded-xl border text-xs space-y-1"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                color: isDark ? '#fca5a5' : '#b91c1c',
              }}
            >
              <p className="font-bold">Comparison Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* TAB 1: AI Comparison Matrix */}
          {!loading && activeTab === 'matrix' && (
            <>
              {!comparisonResult ? (
                /* Empty Prompt State */
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                  >
                    ⚖️
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                      Ready to Compare Documents
                    </h3>
                    <p className="text-xs max-w-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b' }}>
                      Select two corporate policies or runbooks above and click <span className="font-semibold text-purple-400">Generate Matrix</span> to construct a side-by-side comparative table.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Executive Summary Callout */}
                  {textSections.summary && (
                    <div
                      className="p-4 rounded-2xl border space-y-1.5"
                      style={{
                        background: isDark ? 'rgba(168, 85, 247, 0.06)' : '#f5f3ff',
                        borderColor: isDark ? 'rgba(168, 85, 247, 0.20)' : '#ddd6fe',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">💡</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: isDark ? '#d8b4fe' : '#6d28d9' }}>
                          Executive Summary & Context
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#334155' }}>
                        {textSections.summary.replace(/### Executive Summary/g, '').trim()}
                      </p>
                    </div>
                  )}

                  {/* Rendered Structured Table */}
                  {parsedTable && (
                    <div
                      className="rounded-2xl border overflow-hidden shadow-sm"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#e2e8f0',
                        background: isDark ? 'rgba(20, 22, 32, 0.60)' : '#ffffff',
                      }}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr
                              style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                                borderBottom: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #cbd5e1',
                              }}
                            >
                              {parsedTable.headers.map((h, idx) => (
                                <th
                                  key={idx}
                                  className="px-4 py-3 font-bold tracking-tight select-none"
                                  style={{
                                    color: idx === 0
                                      ? (isDark ? '#d8b4fe' : '#7c3aed')
                                      : idx === 1
                                      ? (isDark ? '#38bdf8' : '#0284c7')
                                      : (isDark ? '#34d399' : '#059669'),
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedTable.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={`transition-colors ${
                                  isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                                }`}
                                style={{
                                  borderBottom: rIdx < parsedTable.rows.length - 1
                                    ? isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9'
                                    : 'none',
                                }}
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-4 py-3 align-top leading-relaxed"
                                    style={{
                                      fontWeight: cIdx === 0 ? '600' : 'normal',
                                      color: cIdx === 0
                                        ? (isDark ? '#ffffff' : '#0f172a')
                                        : (isDark ? 'rgba(255,255,255,0.80)' : '#334155'),
                                    }}
                                  >
                                    <CellWithCitations
                                      content={cell}
                                      sources={comparisonResult.sources || []}
                                      onOpenDocumentReader={onOpenDocumentReader}
                                      isDark={isDark}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key Divergences / Recommendations */}
                  {textSections.diffs && (
                    <div
                      className="p-4 rounded-2xl border space-y-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                      }}
                    >
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                        ⚖️ Key Differences & Divergence Points
                      </h4>
                      <div className="text-xs space-y-1.5 leading-relaxed opacity-85">
                        {textSections.diffs.split('\n').filter(Boolean).map((line, idx) => (
                          <p key={idx}>{line.replace(/^###\s+.*$/g, '')}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources Footnote */}
                  {comparisonResult.sources && comparisonResult.sources.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40 mb-2">
                        Retrieved Grounding Sources ({comparisonResult.sources.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {comparisonResult.sources.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (onOpenDocumentReader) {
                                onOpenDocumentReader({
                                  docIdOrName: src.doc_id || src.source,
                                  chunkIndex: src.chunk_index,
                                  snippet: src.text,
                                })
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all hover:scale-105 cursor-pointer border"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                              borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#cbd5e1',
                              color: isDark ? 'rgba(255,255,255,0.80)' : '#334155',
                            }}
                            title={`Inspect [${idx + 1}] in Document Reader`}
                          >
                            <span className="font-bold text-purple-400">[{idx + 1}]</span>
                            <span className="truncate max-w-[150px]">{src.source}</span>
                            <span className="opacity-50 text-[10px]">§{src.chunk_index + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Side-by-Side Raw Chunks */}
          {!loading && activeTab === 'chunks' && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs opacity-60 px-1">
                <span>Direct side-by-side clause inspector for compliance & policy verification</span>
                {chunksLoading && <span>Loading raw document chunks...</span>}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden min-h-[400px]">
                {/* Left Column: Doc A */}
                <div
                  className="flex flex-col rounded-2xl border overflow-hidden"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                  }}
                >
                  <div
                    className="p-3 border-b flex items-center justify-between"
                    style={{
                      background: isDark ? 'rgba(168, 85, 247, 0.10)' : '#f5f3ff',
                      borderColor: isDark ? 'rgba(168, 85, 247, 0.20)' : '#ddd6fe',
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold truncate" style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}>
                        {docA?.name || 'Document A'}
                      </p>
                      <p className="text-[10px] opacity-60">{chunksA.length} indexed chunks</p>
                    </div>
                    {onOpenDocumentReader && docA && (
                      <button
                        type="button"
                        onClick={() => onOpenDocumentReader({ docIdOrName: docA.id || docA.name })}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold underline cursor-pointer"
                      >
                        Reader ↗
                      </button>
                    )}
                  </div>

                  {/* Search filter for Doc A */}
                  <div className="p-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
                    <input
                      type="text"
                      value={searchChunkA}
                      onChange={(e) => setSearchChunkA(e.target.value)}
                      placeholder={`Filter clauses in ${docA?.name || 'Doc A'}...`}
                      className="w-full text-xs px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 outline-none"
                    />
                  </div>

                  {/* Chunks List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 doc-scroll">
                    {filteredChunksA.map((chunk, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border text-xs space-y-1.5 transition-colors"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                          borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                        }}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-50">
                          <span className="font-mono font-bold">Chunk #{chunk.chunk_index + 1}</span>
                          <span>{chunk.text?.split(/\s+/).length || 0} words</span>
                        </div>
                        <p className="leading-relaxed opacity-85">{chunk.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Doc B */}
                <div
                  className="flex flex-col rounded-2xl border overflow-hidden"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                  }}
                >
                  <div
                    className="p-3 border-b flex items-center justify-between"
                    style={{
                      background: isDark ? 'rgba(56, 189, 248, 0.10)' : '#f0f9ff',
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.20)' : '#bae6fd',
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold truncate" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                        {docB?.name || 'Document B'}
                      </p>
                      <p className="text-[10px] opacity-60">{chunksB.length} indexed chunks</p>
                    </div>
                    {onOpenDocumentReader && docB && (
                      <button
                        type="button"
                        onClick={() => onOpenDocumentReader({ docIdOrName: docB.id || docB.name })}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold underline cursor-pointer"
                      >
                        Reader ↗
                      </button>
                    )}
                  </div>

                  {/* Search filter for Doc B */}
                  <div className="p-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
                    <input
                      type="text"
                      value={searchChunkB}
                      onChange={(e) => setSearchChunkB(e.target.value)}
                      placeholder={`Filter clauses in ${docB?.name || 'Doc B'}...`}
                      className="w-full text-xs px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 outline-none"
                    />
                  </div>

                  {/* Chunks List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 doc-scroll">
                    {filteredChunksB.map((chunk, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border text-xs space-y-1.5 transition-colors"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                          borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                        }}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-50">
                          <span className="font-mono font-bold">Chunk #{chunk.chunk_index + 1}</span>
                          <span>{chunk.text?.split(/\s+/).length || 0} words</span>
                        </div>
                        <p className="leading-relaxed opacity-85">{chunk.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Full Markdown Report */}
          {!loading && activeTab === 'raw' && comparisonResult && (
            <div
              className="p-5 rounded-2xl border font-mono text-xs whitespace-pre-wrap leading-relaxed select-text"
              style={{
                background: isDark ? 'rgba(10, 12, 18, 0.70)' : '#f8fafc',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#334155',
              }}
            >
              {comparisonResult.answer}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="px-6 py-3 border-t shrink-0 flex items-center justify-between text-xs select-none"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            background: isDark ? 'rgba(20, 23, 34, 0.70)' : 'rgba(248, 250, 252, 0.85)',
          }}
        >
          <div className="flex items-center gap-2 text-[11px] opacity-50">
            <span>💡 Tip: Click any bracketed citation like [1] to view the original clause in Document Reader.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            style={{ color: isDark ? 'rgba(255,255,255,0.65)' : '#475569' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper to render cell text and make citations like [1], [2] interactive buttons.
 */
function CellWithCitations({ content, sources, onOpenDocumentReader, isDark }) {
  if (!content) return null

  // Split by bracketed citations like [1], [2], [1, 2]
  const parts = content.split(/(\[\d+(?:[,\s]+\d+)*\])/g)

  return (
    <span>
      {parts.map((part, idx) => {
        const match = part.match(/^\[(\d+)\]$/)
        if (match) {
          const citationNum = parseInt(match[1], 10)
          const source = sources[citationNum - 1]

          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (onOpenDocumentReader && source) {
                  onOpenDocumentReader({
                    docIdOrName: source.doc_id || source.source,
                    chunkIndex: source.chunk_index,
                    snippet: source.text,
                  })
                }
              }}
              className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 text-[10px] font-bold rounded-full cursor-pointer transition-transform hover:scale-110 shadow-xs"
              style={{
                background: isDark ? 'rgba(168, 85, 247, 0.22)' : '#ede9fe',
                color: isDark ? '#d8b4fe' : '#6d28d9',
                border: isDark ? '1px solid rgba(168, 85, 247, 0.40)' : '1px solid #ddd6fe',
              }}
              title={source ? `View ${source.source} in Reader` : `Source [${citationNum}]`}
            >
              [{citationNum}]
            </button>
          )
        }
        return <span key={idx}>{part}</span>
      })}
    </span>
  )
}

