import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const DEPARTMENTS = ['hr', 'engineering', 'finance']

const METRICS = [
  { key: 'faithfulness', label: 'Faithfulness' },
  { key: 'answer_relevancy', label: 'Answer Relevancy' },
  { key: 'context_recall', label: 'Context Recall' },
  { key: 'context_precision', label: 'Context Precision' },
]

const DEPT_STYLE = {
  hr: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  engineering: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  finance: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  admin: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
}

function DeptBadge({ dept }) {
  const style = DEPT_STYLE[dept] ?? 'text-white/50 bg-white/5 border-white/10'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
      {dept}
    </span>
  )
}

function ScoreBar({ score }) {
  const pct = score != null ? Math.round(score * 100) : 0
  const color = score == null ? 'bg-white/10' : score >= 0.8 ? 'bg-emerald-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="mt-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-2xl font-bold text-white">{score != null ? score.toFixed(3) : '—'}</span>
        <span className="text-xs text-white/30">{score != null ? `${pct}%` : 'no data'}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Tooltip({ text, children }) {
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
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          fontSize: '0.68rem',
          color: 'rgba(255,255,255,0.65)',
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
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
    </div>
  )
}

function EmptyRow({ cols, message }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-sm text-white/25">{message}</td>
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
  { key: 'documents', label: 'Documents' },
  { key: 'users', label: 'Users' },
  { key: 'eval', label: 'Eval' },
]

export default function AdminPage() {
  const { user, logout } = useAuth()
  const isDemoAdmin = user?.role === 'demo_admin'
  const [tab, setTab] = useState('documents')

  const [docs, setDocs] = useState(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState(null)
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

  useEffect(() => {
    if (tab === 'documents' && docs === null) fetchDocs()
    if (tab === 'users' && users === null) fetchUsers()
    if (tab === 'eval' && evalResults === null) fetchEval()
  }, [tab])

  useEffect(() => {
    if (!evalPolling) return
    const id = setInterval(async () => {
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
    }, 5000)
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

  async function triggerEval() {
    setRunningEval(true)
    setEvalError(null)
    const { runAt: currentLatest } = latestRunScores(evalResults)
    try {
      await api.post('/admin/eval/run')
      setEvalBaselineAt(currentLatest)
      setEvalPolling(true)
    } catch (err) {
      setEvalError(err.response?.data?.detail ?? 'Failed to start eval run.')
    } finally {
      setRunningEval(false)
    }
  }

  const { scores: latestScores, runAt: lastRunAt } = latestRunScores(evalResults)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-sm font-semibold text-white truncate">Enterprise Knowledge Base</span>
          <span className="text-white/20 hidden sm:inline">/</span>
          <span className="text-sm text-white/40 hidden sm:inline">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <span className="text-xs text-white/30 hidden sm:inline">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-white/40 hover:text-white/70 transition-colors py-1.5 px-1"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex gap-1 mb-8 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'text-white border-white'
                  : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'documents' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Upload Document</h2>
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
                    className="block w-full text-sm text-white/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:text-white/70 file:text-xs file:cursor-pointer hover:file:bg-white/10 file:transition-colors"
                  />
                  <select
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-white/30"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d} className="bg-[#111]">{d}</option>
                    ))}
                  </select>
                </div>
                {isDemoAdmin ? (
                  <Tooltip text="Demo accounts have read-only access">
                    <button
                      type="button"
                      disabled
                      className="px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30 whitespace-nowrap cursor-not-allowed"
                    >
                      Upload
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30 hover:bg-white/90 transition-colors whitespace-nowrap"
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                )}
              </form>
              {uploadError && <p className="mt-3 text-xs text-rose-400">{uploadError}</p>}
              {uploadSuccess && <p className="mt-3 text-xs text-emerald-400">Document ingested successfully.</p>}
              {deleteError && <p className="mt-3 text-xs text-rose-400">Delete failed: {deleteError}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Ingested Documents</h2>
                {docs !== null && (
                  <span className="text-xs text-white/30">{docs.length} total</span>
                )}
              </div>
              {docsLoading ? (
                <Spinner />
              ) : docsError ? (
                <p className="px-6 py-12 text-center text-sm text-rose-400">{docsError}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Dept</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Chunks</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Uploaded</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {!docs || docs.length === 0 ? (
                        <EmptyRow cols={5} message="No documents ingested yet." />
                      ) : (
                        docs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3.5 text-white/80 font-mono text-xs max-w-[200px] truncate">{doc.name}</td>
                            <td className="px-6 py-3.5"><DeptBadge dept={doc.department} /></td>
                            <td className="px-6 py-3.5 text-white/50">{doc.chunk_count}</td>
                            <td className="px-6 py-3.5 text-white/40 text-xs whitespace-nowrap">{fmtDate(doc.uploaded_at)}</td>
                            <td className="px-6 py-3.5 text-right" style={{ overflow: 'visible' }}>
                              {isDemoAdmin ? (
                                <Tooltip text="Demo accounts have read-only access">
                                  <button
                                    disabled
                                    className="text-xs text-rose-400/30 disabled:opacity-30 cursor-not-allowed"
                                  >
                                    Delete
                                  </button>
                                </Tooltip>
                              ) : (
                                <button
                                  onClick={() => deleteDoc(doc.id)}
                                  disabled={deletingId === doc.id}
                                  className="text-xs text-rose-400/60 hover:text-rose-400 disabled:opacity-30 transition-colors"
                                >
                                  {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Users</h2>
              {users !== null && (
                <span className="text-xs text-white/30">{users.length} total</span>
              )}
            </div>
            {usersLoading ? (
              <Spinner />
            ) : usersError ? (
              <p className="px-6 py-12 text-center text-sm text-rose-400">{usersError}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Joined</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {!users || users.length === 0 ? (
                      <EmptyRow cols={4} message="No users found." />
                    ) : (
                      users.map((u) => {
                        const displayEmail = isDemoAdmin && u.email.includes('shikharjain')
                          ? 'admin@apex-systems.com'
                          : u.email
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3.5 text-white/80 text-xs">{displayEmail}</td>
                            <td className="px-6 py-3.5"><DeptBadge dept={u.role} /></td>
                            <td className="px-6 py-3.5 text-white/40 text-xs whitespace-nowrap">{fmtDate(u.created_at)}</td>
                            <td className="px-6 py-3.5 text-right" style={{ overflow: 'visible' }}>
                              {isDemoAdmin ? (
                                <Tooltip text="Demo accounts have read-only access">
                                  <button
                                    disabled
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full disabled:opacity-30 cursor-not-allowed focus:outline-none ${
                                      u.is_active ? 'bg-emerald-500' : 'bg-white/10'
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
                                    u.is_active ? 'bg-emerald-500' : 'bg-white/10'
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
                <h2 className="text-sm font-semibold text-white">RAGAS Evaluation</h2>
                {lastRunAt ? (
                  <p className="mt-1 text-xs text-white/30">Last run: {fmtTs(lastRunAt)}</p>
                ) : (
                  <p className="mt-1 text-xs text-white/30">No runs yet.</p>
                )}
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                {isDemoAdmin ? (
                  <Tooltip text="Demo accounts cannot run evaluations.">
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium opacity-40 whitespace-nowrap cursor-not-allowed"
                    >
                      Run Eval
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    onClick={triggerEval}
                    disabled={runningEval || evalPolling}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-40 hover:bg-white/90 transition-colors whitespace-nowrap"
                  >
                    {evalPolling && (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    )}
                    {runningEval ? 'Starting…' : evalPolling ? 'Running…' : 'Run Eval'}
                  </button>
                )}
                {evalError && (
                  <span className="text-xs text-rose-400">{evalError}</span>
                )}
              </div>
            </div>

            {evalPolling && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
                <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
                <div>
                  <p className="text-xs font-medium text-amber-400">Evaluation in progress</p>
                  <p className="text-xs text-amber-400/60 mt-0.5">Typically takes 5–8 minutes. Results will update automatically.</p>
                </div>
              </div>
            )}

            {evalLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {METRICS.map(({ key, label }) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wide">{label}</p>
                      <ScoreBar score={latestScores[key] ?? null} />
                    </div>
                  ))}
                </div>
                {evalResults !== null && evalResults.length === 0 && !evalPolling && (
                  <p className="text-center text-sm text-white/25 py-4">
                    No eval results yet. Click "Run Eval" to start.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
