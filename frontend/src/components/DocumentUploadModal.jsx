import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { uploadDocument } from '../services/documents'

const DEPT_INFO = {
  hr:          { name: 'Human Resources', dot: '#a78bfa', text: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.30)' },
  engineering: { name: 'Engineering',     dot: '#38bdf8', text: '#38bdf8', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.30)' },
  finance:     { name: 'Finance',         dot: '#34d399', text: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)' },
}

const ALLOWED_EXTS = ['.pdf', '.txt', '.md']
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export default function DocumentUploadModal({
  isOpen,
  onClose,
  user,
  initialFile = null,
  onUploadSuccess,
  onOpenReader,
  onFocusDoc,
}) {
  const { isDark } = useTheme()
  const [file, setFile] = useState(initialFile)
  const [department, setDepartment] = useState(user?.role !== 'admin' && user?.role !== 'demo_admin' ? user?.role : 'hr')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState(0) // 0: Idle, 1: Uploading, 2: Chunking, 3: Embedding, 4: BM25
  const [error, setError] = useState(null)
  const [successResult, setSuccessResult] = useState(null)
  const fileInputRef = useRef(null)

  const isAdmin = user?.role === 'admin' || user?.role === 'demo_admin'
  const dept = DEPT_INFO[department] || DEPT_INFO.hr

  useEffect(() => {
    if (initialFile) {
      validateAndSetFile(initialFile)
    }
  }, [initialFile])

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setFile(null)
      setError(null)
      setSuccessResult(null)
      setIsUploading(false)
      setUploadStep(0)
    }
  }, [isOpen])

  // Keyboard shortcut listener: ESC to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isUploading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isUploading, onClose])

  if (!isOpen) return null

  function validateAndSetFile(candidate) {
    if (!candidate) return
    setError(null)
    const ext = '.' + candidate.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`Unsupported file type '${ext}'. Please upload .pdf, .txt, or .md files.`)
      return
    }
    if (candidate.size > MAX_BYTES) {
      setError(`File size (${(candidate.size / (1024 * 1024)).toFixed(1)} MB) exceeds 20 MB limit.`)
      return
    }
    setFile(candidate)
    setSuccessResult(null)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  function handleFileInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  async function handleStartIngestion() {
    if (!file || isUploading) return
    setIsUploading(true)
    setError(null)
    setUploadStep(1)

    // Simulate progress milestones while server processes
    const timer1 = setTimeout(() => setUploadStep(2), 1200)
    const timer2 = setTimeout(() => setUploadStep(3), 2800)

    try {
      const targetDept = isAdmin ? department : user?.role
      const result = await uploadDocument(file, targetDept)
      setUploadStep(4)
      setSuccessResult(result)
      if (onUploadSuccess) {
        onUploadSuccess(result)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to ingest document. Please verify file integrity.')
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsUploading(false)
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 transition-all"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(16px)',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
      onClick={!isUploading ? onClose : undefined}
    >
      {/* macOS Window Frame */}
      <div
        className="relative flex flex-col w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl transition-all border select-none"
        style={{
          background: isDark ? 'rgba(18, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(32px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
          boxShadow: isDark
            ? '0 32px 72px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 32px 72px -12px rgba(15,23,42,0.20), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar (macOS Sonoma / Sequoia Style) */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b select-none shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            background: isDark ? 'rgba(24, 27, 40, 0.85)' : 'rgba(248, 250, 252, 0.90)',
          }}
        >
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              onClick={!isUploading ? onClose : undefined}
              disabled={isUploading}
              className="w-3 h-3 rounded-full flex items-center justify-center transition-transform hover:scale-110 group cursor-pointer disabled:opacity-40"
              style={{ background: '#ff5f57' }}
              title="Close window (Esc)"
            >
              <span className="text-[8px] text-[#4a0000] font-black opacity-0 group-hover:opacity-100">✕</span>
            </button>
            <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e', opacity: 0.8 }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28c840', opacity: 0.8 }} />

            <span className="ml-3 text-[11px] font-semibold uppercase tracking-wider font-mono opacity-50">
              NexusRAG Ingest
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-sm">📂</span>
            <span className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>
              Document Ingestion Drawer
            </span>
          </div>

          <button
            onClick={!isUploading ? onClose : undefined}
            disabled={isUploading}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer disabled:opacity-30"
            style={{
              color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Target Department Selection */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <label className="font-semibold tracking-wide" style={{ color: isDark ? 'rgba(255,255,255,0.70)' : '#475569' }}>
              Target Knowledge Base:
            </label>

            {isAdmin ? (
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={isUploading || !!successResult}
                className="px-3 py-1.5 rounded-lg text-xs font-medium outline-none border cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                }}
              >
                <option value="hr">Human Resources (HR)</option>
                <option value="engineering">Engineering</option>
                <option value="finance">Finance</option>
              </select>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: dept.bg,
                  color: dept.text,
                  border: `1px solid ${dept.border}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: dept.dot }} />
                <span>{dept.name}</span>
                <span className="text-[10px] opacity-70 ml-1">· Role Scoped</span>
              </div>
            )}
          </div>

          {/* Success Result View */}
          {successResult ? (
            <div
              className="p-5 rounded-2xl border text-center space-y-4 animate-fadeIn"
              style={{
                background: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.30)' : '#a7f3d0',
              }}
            >
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-2xl shadow-sm"
                style={{ background: isDark ? 'rgba(16, 185, 129, 0.20)' : '#d1fae5' }}
              >
                🎉
              </div>

              <div>
                <h3 className="text-sm font-bold" style={{ color: isDark ? '#34d399' : '#065f46' }}>
                  Document Successfully Indexed!
                </h3>
                <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.70)' : '#047857' }}>
                  <span className="font-semibold">{successResult.filename}</span> is now searchable with hybrid vectors and BM25 sparse tokens.
                </p>
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    color: isDark ? '#a7f3d0' : '#065f46',
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
                  }}
                >
                  <span>⚡ {successResult.chunk_count || 'Multiple'} Vector Chunks</span>
                  <span>·</span>
                  <span className="uppercase">{successResult.department}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {onOpenReader && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenReader({ docIdOrName: successResult.doc_id || successResult.filename })
                      onClose()
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.12)' : '#ffffff',
                      border: isDark ? '1px solid rgba(255,255,255,0.20)' : '1px solid #cbd5e1',
                      color: isDark ? '#ffffff' : '#0f172a',
                    }}
                  >
                    📖 View in Reader
                  </button>
                )}

                {onFocusDoc && (
                  <button
                    type="button"
                    onClick={() => {
                      onFocusDoc({ id: successResult.doc_id, name: successResult.filename })
                      onClose()
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                    style={{
                      background: isDark ? 'rgba(168,85,247,0.22)' : '#f3e8ff',
                      color: isDark ? '#d8b4fe' : '#7e22ce',
                      border: isDark ? '1px solid rgba(168,85,247,0.40)' : '1px solid #d8b4fe',
                    }}
                  >
                    🎯 Focus Q&A on this File
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setSuccessResult(null)
                    setUploadStep(0)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    color: isDark ? 'rgba(255,255,255,0.60)' : '#64748b',
                  }}
                >
                  + Upload Another
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dropzone Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !file && !isUploading && fileInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed p-7 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'scale-[1.01] border-purple-500 bg-purple-500/10'
                    : file
                    ? 'border-solid border-purple-500/40 bg-purple-500/5'
                    : isDark
                    ? 'border-white/15 hover:border-white/30 hover:bg-white/[0.02]'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {!file ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl transition-transform"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      ☁️
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm font-semibold" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                        Drag & drop policy or runbook file here
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#64748b' }}>
                        or <span className="text-purple-400 font-semibold underline underline-offset-2">browse computer</span>
                      </p>
                    </div>

                    {/* Supported Format Pills */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {['PDF', 'TXT', 'MARKDOWN'].map((format) => (
                        <span
                          key={format}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                            color: isDark ? 'rgba(255,255,255,0.60)' : '#475569',
                          }}
                        >
                          {format}
                        </span>
                      ))}
                      <span className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.30)' : '#94a3b8' }}>
                        · Max 20 MB
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Selected File Preview Card */
                  <div className="flex items-center justify-between gap-3 p-2 text-left" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: isDark ? 'rgba(168,85,247,0.20)' : '#f3e8ff' }}
                      >
                        {file.name.endsWith('.pdf') ? '📕' : file.name.endsWith('.md') ? '📝' : '📄'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#fff' : '#0f172a' }}>
                          {file.name}
                        </p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
                          {formatBytes(file.size)} · Ready to index
                        </p>
                      </div>
                    </div>

                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                          color: isDark ? 'rgba(255,255,255,0.50)' : '#64748b',
                        }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Ingestion Pipeline Stepper (when uploading) */}
              {isUploading && (
                <div
                  className="p-4 rounded-xl border space-y-3"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-2" style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}>
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                      {uploadStep === 1 && 'Uploading encrypted file...'}
                      {uploadStep === 2 && 'Text extraction & semantic chunking...'}
                      {uploadStep === 3 && 'Generating BGE vectors & upserting Qdrant Cloud...'}
                      {uploadStep === 4 && 'Rebuilding hybrid BM25 index...'}
                    </span>
                    <span className="font-mono text-[10px] opacity-60">Step {uploadStep} of 4</span>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${uploadStep === 1 ? 25 : uploadStep === 2 ? 55 : uploadStep === 3 ? 85 : 100}%`,
                        background: 'linear-gradient(90deg, #7c3aed 0%, #38bdf8 100%)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div
                  className="p-3 rounded-xl border text-xs"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    color: isDark ? '#fca5a5' : '#b91c1c',
                  }}
                >
                  <span className="font-semibold">Upload failed: </span>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div
            className="flex items-center justify-between px-6 py-3.5 border-t shrink-0 text-xs"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              background: isDark ? 'rgba(24, 27, 40, 0.70)' : 'rgba(248, 250, 252, 0.85)',
            }}
          >
            <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>
              Enforces strict department isolation
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-40"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.65)' : '#475569',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleStartIngestion}
                disabled={!file || isUploading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                  boxShadow: file && !isUploading ? '0 4px 14px rgba(124, 58, 237, 0.4)' : 'none',
                }}
              >
                {isUploading ? (
                  <>
                    <span className="w-3 h-3 rounded-full border border-t-transparent border-white animate-spin" />
                    <span>Indexing Chunks...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Ingest & Vector Index</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
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

