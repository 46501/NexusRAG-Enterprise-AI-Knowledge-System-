import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import BackHomeButton from '../components/BackHomeButton'
import UserProfileMenu from '../components/UserProfileMenu'
import AnalyticsTab from '../components/AnalyticsTab'
import ObservabilityTab from '../components/ObservabilityTab'
import KnowledgeOpsTab from '../components/KnowledgeOpsTab'
import SecurityAuditTab from '../components/SecurityAuditTab'
import DocumentReaderModal from '../components/DocumentReaderModal'
import api from '../services/api'

const DEPARTMENTS = ['hr', 'engineering', 'finance']

const METRICS = [
  { key: 'faithfulness', label: 'Faithfulness' },
  { key: 'answer_relevancy', label: 'Answer Relevancy' },
  { key: 'context_recall', label: 'Context Recall' },
  { key: 'context_precision', label: 'Context Precision' },
]

const DEPT_STYLE_DARK = {
  hr: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  engineering: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  finance: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  admin: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
}

const DEPT_STYLE_LIGHT = {
  hr: 'text-violet-700 bg-violet-50 border-violet-200',
  engineering: 'text-sky-700 bg-sky-50 border-sky-200',
  finance: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  admin: 'text-rose-700 bg-rose-50 border-rose-200',
}

function DeptBadge({ dept }) {
  const { isDark } = useTheme()
  const map = isDark ? DEPT_STYLE_DARK : DEPT_STYLE_LIGHT
  const fallback = isDark ? 'text-white/50 bg-white/5 border-white/10' : 'text-slate-600 bg-slate-100 border-slate-200'
  const style = map[dept] ?? fallback
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
      {dept}
    </span>
  )
}

function ScoreBar({ score }) {
  const { isDark } = useTheme()
  const pct = score != null ? Math.round(score * 100) : 0
  const color = score == null ? (isDark ? 'bg-white/10' : 'bg-slate-300') : score >= 0.8 ? 'bg-emerald-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="mt-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{score != null ? score.toFixed(3) : '—'}</span>
        <span className={`text-xs ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{score != null ? `${pct}%` : 'no data'}</span>
      </div>
      <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Tooltip({ text, children }) {
  const { isDark } = useTheme()
  const [vis, setVis] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', overflow: 'visible' }}
      onMouseEnter={() => setVis(true)}
      onMouseLeave={() => setVis(false)}
    >
      {children}
      {vis && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          right: 0,
          left: 'auto',
          padding: '4px 8px',
          background: isDark ? '#1a1a1a' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: '0.68rem',
          color: isDark ? 'rgba(255,255,255,0.65)' : '#475569',
          boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

function Spinner() {
  const { isDark } = useTheme()
  return (
    <div className="flex items-center justify-center py-16">
      <div className={`h-5 w-5 rounded-full border-2 animate-spin ${isDark ? 'border-white/20 border-t-white/70' : 'border-slate-300 border-t-slate-700'}`} />
    </div>
  )
}

function EmptyRow({ cols, message }) {
  const { isDark } = useTheme()
  return (
    <tr>
      <td colSpan={cols} className={`py-12 text-center text-sm ${isDark ? 'text-white/25' : 'text-slate-400'}`}>{message}</td>
    </tr>
  )
}

function latestRunScores(results) {
  if (!results || results.length === 0) return { scores: {}, runAt: null }
  const runs = {}
  for (const r of results) {
    if (!runs[r.run_id]) runs[r.run_id] = { runAt: r.run_at, scores: {} }
    if (r.run_at > runs[r.run_id].runAt) runs[r.run_id].runAt = r.run_at
    if (r.score != null && !Number.isNaN(r.score)) {
      runs[r.run_id].scores[r.metric_name] = r.score
    }
  }
  let latestId = null, latestAt = ''
  for (const [id, run] of Object.entries(runs)) {
    if (run.runAt > latestAt) { latestAt = run.runAt; latestId = id }
  }
  return { scores: runs[latestId].scores, runAt: latestAt }
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTs(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const TABS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'security', label: 'Security (Tier 5)' },
  { key: 'observability', label: 'Observability & Drift (Tier 3)' },
  { key: 'knowledge_ops', label: 'Knowledge Ops (Tier 4)' },
  { key: 'documents', label: 'Documents' },
  { key: 'users', label: 'Users' },
  { key: 'eval', label: 'Eval' },
]

export default function AdminPage() {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const isDemoAdmin = user?.role === 'demo_admin'
  const [tab, setTab] = useState('analytics')

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)

  const [docs, setDocs] = useState(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState(null)
  const [readerDoc, setReaderDoc] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDept, setUploadDept] = useState('hr')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileRef = useRef(null)

  const [users, setUsers] = useState(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const [evalResults, setEvalResults] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalError, setEvalError] = useState(null)
  const [runningEval, setRunningEval] = useState(false)
  const [evalPolling, setEvalPolling] = useState(false)
  const [evalBaselineAt, setEvalBaselineAt] = useState(null)
  const [evalStatusInfo, setEvalStatusInfo] = useState(null)

  useEffect(() => {
    if (tab === 'analytics' && analytics === null) fetchAnalytics()
    if (tab === 'documents' && docs === null) fetchDocs()
    if (tab === 'users' && users === null) fetchUsers()
    if (tab === 'eval') {
      if (evalResults === null) fetchEval()
      checkEvalStatus()
    }
  }, [tab])

  async function checkEvalStatus() {
    try {
      const res = await api.get('/admin/eval/status')
      const st = res.data
      setEvalStatusInfo(st)
      if (st?.is_running) {
        setEvalPolling(true)
      } else if (st?.error && evalPolling) {
        setEvalPolling(false)
        setEvalError(st.error)
      }
    } catch {
      // ignore status endpoint error
    }
  }

  async function fetchAnalytics() {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const res = await api.get('/admin/analytics')
      setAnalytics(res.data)
    } catch (err) {
      setAnalyticsError(err.response?.data?.detail ?? 'Failed to load analytics.')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    if (!evalPolling) return
    let pollCount = 0
    const maxPolls = 180 // 180 * 3.5s = ~10.5 mins safety timeout
    const id = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        setEvalPolling(false)
        setEvalError('Evaluation timed out after 10 minutes. Please check server logs.')
        clearInterval(id)
        return
      }

      try {
        const resStatus = await api.get('/admin/eval/status')
        const st = resStatus.data
        setEvalStatusInfo(st)

        if (!st?.is_running) {
          setEvalPolling(false)
          clearInterval(id)
          if (st?.error) {
            setEvalError(st.error)
          } else {
            const res = await api.get('/admin/eval/results')
            setEvalResults(res.data)
          }
          return
        }
      } catch {
        // Fallback to checking results directly if status route encounters an issue
        try {
          const res = await api.get('/admin/eval/results')
          const rows = res.data
          if (rows && rows.length > 0) {
            const latestAt = rows.reduce((max, r) => (r.run_at > max ? r.run_at : max), '')
            if (!evalBaselineAt || latestAt > evalBaselineAt) {
              setEvalResults(rows)
              setEvalPolling(false)
              clearInterval(id)
            }
          }
        } catch {
          // keep polling
        }
      }
    }, 3500)
    return () => clearInterval(id)
  }, [evalPolling, evalBaselineAt])

  async function fetchDocs() {
    setDocsLoading(true)
    setDocsError(null)
    try {
      const res = await api.get('/admin/documents')
      setDocs(res.data.documents)
    } catch {
      setDocsError('Failed to load documents.')
    } finally {
      setDocsLoading(false)
    }
  }

  async function deleteDoc(id) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      await api.delete(`/admin/documents/${id}`)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setDeleteError(err.response?.data?.detail ?? 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)
    const form = new FormData()
    form.append('file', uploadFile)
    form.append('department', uploadDept)
    try {
      await api.post('/ingest', form)
      setUploadFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setUploadSuccess(true)
      setDocs(null)
      fetchDocs()
    } catch (err) {
      setUploadError(err.response?.data?.detail ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function fetchUsers() {
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data)
    } catch {
      setUsersError('Failed to load users.')
    } finally {
      setUsersLoading(false)
    }
  }

  async function toggleActive(userId, current) {
    setTogglingId(userId)
    try {
      const res = await api.patch(`/admin/users/${userId}/active`, { is_active: !current })
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)))
    } catch {
      // no state change on error
    } finally {
      setTogglingId(null)
    }
  }

  async function fetchEval() {
    setEvalLoading(true)
    setEvalError(null)
    try {
      const res = await api.get('/admin/eval/results')
      setEvalResults(res.data)
    } catch {
      setEvalError('Failed to load eval results.')
    } finally {
      setEvalLoading(false)
    }
  }

  function groupEvalRuns(results) {
    if (!results || results.length === 0) return []
    const runs = {}
    for (const r of results) {
      if (!runs[r.run_id]) runs[r.run_id] = { id: r.run_id, runAt: r.run_at, scores: {} }
      if (r.run_at > runs[r.run_id].runAt) runs[r.run_id].runAt = r.run_at
      if (r.score != null && !Number.isNaN(r.score)) {
        runs[r.run_id].scores[r.metric_name] = r.score
      }
    }
    return Object.values(runs).sort((a, b) => (b.runAt > a.runAt ? 1 : -1))
  }

  async function triggerEval() {
    if (isDemoAdmin || runningEval || evalPolling) return
    setRunningEval(true)
    setEvalError(null)
    const { runAt: currentLatest } = latestRunScores(evalResults)
    try {
      await api.post('/admin/eval/run')
      setEvalBaselineAt(currentLatest)
      setEvalStatusInfo({ is_running: true, progress: 'Starting evaluation...' })
      setEvalPolling(true)
    } catch (err) {
      setEvalError(err.response?.data?.detail ?? 'Failed to start eval run.')
    } finally {
      setRunningEval(false)
    }
  }

  const { scores: latestScores, runAt: lastRunAt } = latestRunScores(evalResults)
  const evalRuns = groupEvalRuns(evalResults)

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8fafc] text-slate-900'} transition-colors`}>
      <header className={`border-b ${isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-slate-200 bg-white shadow-sm'} px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between transition-colors`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BackHomeButton />
          <span className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>Enterprise Knowledge Base</span>
          <span className={`${isDark ? 'text-white/20' : 'text-slate-300'} hidden sm:inline`}>/</span>
          <span className={`text-sm ${isDark ? 'text-white/40' : 'text-slate-500'} hidden sm:inline`}>Admin Panel</span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
          <UserProfileMenu />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={`flex gap-1 mb-8 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? isDark ? 'text-white border-white' : 'text-slate-900 border-slate-900 font-semibold'
                  : isDark ? 'text-white/40 border-transparent hover:text-white/70' : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'analytics' && (
          <AnalyticsTab
            data={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRefresh={fetchAnalytics}
          />
        )}

        {tab === 'security' && (
          <SecurityAuditTab isDemoAdmin={isDemoAdmin} />
        )}

        {tab === 'observability' && (
          <ObservabilityTab isDemoAdmin={isDemoAdmin} />
        )}

        {tab === 'knowledge_ops' && (
          <KnowledgeOpsTab isDemoAdmin={isDemoAdmin} />
        )}

        {tab === 'documents' && (
          <div className="space-y-6">
            <div className={`rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'} p-6 transition-colors`}>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'} mb-4`}>Upload Document</h2>
              <form onSubmit={handleUpload} className="flex flex-col gap-3">
                <div
                  className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                  style={isDemoAdmin ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => { setUploadFile(e.target.files[0] ?? null); setUploadSuccess(false) }}
                    className={`block w-full text-sm ${
                      isDark
                        ? 'text-white/50 file:border-white/10 file:bg-white/5 file:text-white/70 hover:file:bg-white/10'
                        : 'text-slate-600 file:border-slate-200 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200'
                    } file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:text-xs file:cursor-pointer file:transition-colors`}
                  />
                  <select
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                      isDark
                        ? 'border-white/10 bg-white/5 text-white/70 focus:border-white/30'
                        : 'border-slate-300 bg-white text-slate-700 focus:border-violet-500'
                    }`}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d} className={isDark ? "bg-[#111]" : "bg-white"}>{d}</option>
                    ))}
                  </select>
                </div>
                {isDemoAdmin ? (
                  <Tooltip text="Demo accounts have read-only access">
                    <button
                      type="button"
                      disabled
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30 whitespace-nowrap cursor-not-allowed ${
                        isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                      }`}
                    >
                      Upload
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30 transition-colors whitespace-nowrap ${
                      isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                )}
              </form>
              {uploadError && <p className="mt-3 text-xs text-rose-500">{uploadError}</p>}
              {uploadSuccess && <p className="mt-3 text-xs text-emerald-500">Document ingested successfully.</p>}
              {deleteError && <p className="mt-3 text-xs text-rose-500">Delete failed: {deleteError}</p>}
            </div>

            <div className={`rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'} overflow-hidden transition-colors`}>
              <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'} flex items-center justify-between`}>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ingested Documents</h2>
                {docs !== null && (
                  <span className={`text-xs ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{docs.length} total</span>
                )}
              </div>
              {docsLoading ? (
                <Spinner />
              ) : docsError ? (
                <p className="px-6 py-12 text-center text-sm text-rose-500">{docsError}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10' : 'border-slate-200 bg-slate-50/70'}`}>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Name</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Dept</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Chunks</th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Uploaded</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
                      {!docs || docs.length === 0 ? (
                        <EmptyRow cols={5} message="No documents ingested yet." />
                      ) : (
                        docs.map((doc) => (
                          <tr key={doc.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'} transition-colors`}>
                            <td className={`px-6 py-3.5 font-mono text-xs max-w-[200px] truncate ${isDark ? 'text-white/80' : 'text-slate-800'}`}>{doc.name}</td>
                            <td className="px-6 py-3.5"><DeptBadge dept={doc.department} /></td>
                            <td className={`px-6 py-3.5 ${isDark ? 'text-white/50' : 'text-slate-600'}`}>{doc.chunk_count}</td>
                            <td className={`px-6 py-3.5 ${isDark ? 'text-white/40' : 'text-slate-500'} text-xs whitespace-nowrap`}>{fmtDate(doc.uploaded_at)}</td>
                            <td className="px-6 py-3.5 text-right" style={{ overflow: 'visible' }}>
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => setReaderDoc(doc.id || doc.name)}
                                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors cursor-pointer"
                                  title={`Open ${doc.name} in Reader`}
                                >
                                  Read ↗
                                </button>
                                {isDemoAdmin ? (
                                  <Tooltip text="Demo accounts have read-only access">
                                    <button
                                      disabled
                                      className="text-xs text-rose-500/30 disabled:opacity-30 cursor-not-allowed"
                                    >
                                      Delete
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <button
                                    onClick={() => deleteDoc(doc.id)}
                                    disabled={deletingId === doc.id}
                                    className="text-xs text-rose-500 hover:text-rose-600 disabled:opacity-30 transition-colors"
                                  >
                                    {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className={`rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'} overflow-hidden transition-colors`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'} flex items-center justify-between`}>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Users</h2>
              {users !== null && (
                <span className={`text-xs ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{users.length} total</span>
              )}
            </div>
            {usersLoading ? (
              <Spinner />
            ) : usersError ? (
              <p className="px-6 py-12 text-center text-sm text-rose-500">{usersError}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/10' : 'border-slate-200 bg-slate-50/70'}`}>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>User</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Role</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Joined</th>
                      <th className={`px-6 py-3 text-right text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Active</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
                    {!users || users.length === 0 ? (
                      <EmptyRow cols={4} message="No users found." />
                    ) : (
                      users.map((u) => {
                        const displayEmail = isDemoAdmin && u.email.includes('shikharjain')
                          ? 'admin@apex-systems.com'
                          : u.email
                        return (
                          <tr key={u.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'} transition-colors`}>
                            <td className="px-6 py-3.5 text-xs">
                              <div className={`font-medium ${isDark ? 'text-white/90' : 'text-slate-900'}`}>
                                {u.full_name || (u.role === 'admin' ? 'System Administrator' : `${u.role.toUpperCase()} User`)}
                              </div>
                              <div className={`${isDark ? 'text-white/40' : 'text-slate-500'} text-[11px] font-mono mt-0.5`}>{displayEmail}</div>
                            </td>
                            <td className="px-6 py-3.5"><DeptBadge dept={u.role} /></td>
                            <td className={`px-6 py-3.5 ${isDark ? 'text-white/40' : 'text-slate-500'} text-xs whitespace-nowrap`}>{fmtDate(u.created_at)}</td>
                            <td className="px-6 py-3.5 text-right" style={{ overflow: 'visible' }}>
                              {isDemoAdmin ? (
                                <Tooltip text="Demo accounts have read-only access">
                                  <button
                                    disabled
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full disabled:opacity-30 cursor-not-allowed focus:outline-none ${
                                      u.is_active ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow ${
                                        u.is_active ? 'translate-x-4' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </Tooltip>
                              ) : (
                                <button
                                  onClick={() => toggleActive(u.id, u.is_active)}
                                  disabled={togglingId === u.id || u.id === user?.id}
                                  title={u.id === user?.id ? 'Cannot disable your own account' : undefined}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-30 focus:outline-none ${
                                    u.is_active ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                      u.is_active ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'eval' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>RAGAS Evaluation</h2>
                {lastRunAt ? (
                  <p className={`mt-1 text-xs ${isDark ? 'text-white/30' : 'text-slate-500'}`}>Last run: {fmtTs(lastRunAt)}</p>
                ) : (
                  <p className={`mt-1 text-xs ${isDark ? 'text-white/30' : 'text-slate-500'}`}>No runs yet.</p>
                )}
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                {isDemoAdmin ? (
                  <Tooltip text="Demo accounts cannot run evaluations.">
                    <button
                      disabled
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium opacity-40 whitespace-nowrap cursor-not-allowed ${
                        isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                      }`}
                    >
                      Run Eval
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    onClick={triggerEval}
                    disabled={runningEval || evalPolling}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors whitespace-nowrap ${
                      isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {evalPolling && (
                      <span className={`h-3.5 w-3.5 rounded-full border-2 animate-spin ${
                        isDark ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'
                      }`} />
                    )}
                    {runningEval ? 'Starting…' : evalPolling ? 'Running…' : 'Run Eval'}
                  </button>
                )}
                {evalError && (
                  <span className="text-xs text-rose-500">{evalError}</span>
                )}
              </div>
            </div>

            {evalPolling && (
              <div className={`rounded-xl border ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-500/30 bg-amber-50'} px-4 py-3 flex items-start gap-3`}>
                <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-amber-500/40 border-t-amber-500 animate-spin" />
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Evaluation in progress</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-amber-400/60' : 'text-amber-700/80'}`}>
                    {evalStatusInfo?.progress || 'Running RAGAS evaluation across enterprise benchmark dataset. Results will update automatically.'}
                  </p>
                </div>
              </div>
            )}

            {evalLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {METRICS.map(({ key, label }) => (
                    <div key={key} className={`rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'} p-5 transition-colors`}>
                      <p className={`text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>{label}</p>
                      <ScoreBar score={latestScores[key] ?? null} />
                    </div>
                  ))}
                </div>
                {evalResults !== null && evalResults.length === 0 && !evalPolling && (
                  <p className={`text-center text-sm ${isDark ? 'text-white/25' : 'text-slate-400'} py-4`}>
                    No eval results yet. Click "Run Eval" to start.
                  </p>
                )}

                {evalRuns.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'} uppercase tracking-wide`}>
                      Run History ({evalRuns.length})
                    </h3>
                    <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-sm'}`}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={`border-b ${isDark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-500'}`}>
                            <th className="px-4 py-2.5 text-left font-medium">Timestamp</th>
                            <th className="px-4 py-2.5 text-right font-medium">Faithfulness</th>
                            <th className="px-4 py-2.5 text-right font-medium">Answer Relevancy</th>
                            <th className="px-4 py-2.5 text-right font-medium">Context Precision</th>
                            <th className="px-4 py-2.5 text-right font-medium">Context Recall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evalRuns.slice(0, 10).map((run) => (
                            <tr key={run.id} className={`border-b last:border-b-0 ${isDark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50'}`}>
                              <td className={`px-4 py-2 font-mono ${isDark ? 'text-white/70' : 'text-slate-700'}`}>{fmtTs(run.runAt)}</td>
                              <td className="px-4 py-2 text-right font-mono">{run.scores.faithfulness != null ? `${(run.scores.faithfulness * 100).toFixed(1)}%` : '—'}</td>
                              <td className="px-4 py-2 text-right font-mono">{run.scores.answer_relevancy != null ? `${(run.scores.answer_relevancy * 100).toFixed(1)}%` : '—'}</td>
                              <td className="px-4 py-2 text-right font-mono">{run.scores.context_precision != null ? `${(run.scores.context_precision * 100).toFixed(1)}%` : '—'}</td>
                              <td className="px-4 py-2 text-right font-mono">{run.scores.context_recall != null ? `${(run.scores.context_recall * 100).toFixed(1)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <DocumentReaderModal
        isOpen={!!readerDoc}
        onClose={() => setReaderDoc(null)}
        docIdOrName={readerDoc}
      />
    </div>
  )
}
