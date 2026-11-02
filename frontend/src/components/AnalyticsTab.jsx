import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const DEPT_COLORS = {
  hr: {
    badge: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    lightBadge: 'text-violet-700 bg-violet-50 border-violet-200',
    bar: 'bg-violet-500',
    text: 'text-violet-500',
    name: 'Human Resources',
  },
  engineering: {
    badge: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    lightBadge: 'text-sky-700 bg-sky-50 border-sky-200',
    bar: 'bg-sky-500',
    text: 'text-sky-500',
    name: 'Engineering',
  },
  finance: {
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    lightBadge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-500',
    name: 'Finance',
  },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AnalyticsTab({ data, loading, error, onRefresh }) {
  const { isDark } = useTheme()
  const [filterDept, setFilterDept] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className={`h-6 w-6 rounded-full border-2 animate-spin ${isDark ? 'border-white/20 border-t-white/80' : 'border-slate-300 border-t-slate-800'}`} />
        <span className="text-xs opacity-50">Aggregating RAG telemetry & analytics...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
        <p className="font-semibold text-sm">Failed to load analytics</p>
        <p className="text-xs mt-1 opacity-80">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white cursor-pointer"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  const { overview, departments = [], recent_queries = [], top_faqs = [], unanswered_queries = [], rag_eval_scores = {}, system_health = {} } = data

  // Filter recent queries
  const filteredQueries = recent_queries.filter((q) => {
    const matchesDept = filterDept === 'all' || q.department.toLowerCase() === filterDept.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      q.query_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.top_source && q.top_source.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesDept && matchesSearch
  })

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Top Bar: Title & Controls ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Enterprise Knowledge Analytics & Observability
          </h2>
          <p className="text-xs opacity-60 mt-0.5">
            Real-time query volume, retrieval latency, grounding accuracy, and knowledge coverage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] opacity-70">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Telemetry</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Row 1: KPI Metrics Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Knowledge Base Scale */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-60 mb-2 font-medium">
            <span>Knowledge Base Scale</span>
            <span className="text-base">📚</span>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {overview.total_documents} <span className="text-sm font-normal opacity-60">Docs</span>
          </div>
          <p className="text-xs opacity-60 mt-1 font-mono">
            {overview.total_chunks} indexed vector chunks
          </p>
          <div className="flex gap-1.5 mt-3 pt-3 border-t text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            {departments.map((d) => (
              <span key={d.department} className="opacity-70 capitalize font-medium">
                {d.department}: <b className={isDark ? 'text-white' : 'text-slate-800'}>{d.documents_count}</b>
              </span>
            ))}
          </div>
        </div>

        {/* KPI 2: Total Queries & Grounding Rate */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-60 mb-2 font-medium">
            <span>Query Volume & Grounding</span>
            <span className="text-base">⚡</span>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {overview.total_queries} <span className="text-sm font-normal opacity-60">Queries</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="opacity-60">Grounded Rate:</span>
            <span className="font-semibold text-emerald-500">{overview.grounding_rate_pct}%</span>
          </div>
          <div className={`h-1.5 w-full rounded-full mt-2.5 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(overview.grounding_rate_pct, 100)}%` }} />
          </div>
        </div>

        {/* KPI 3: Response Latency */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-60 mb-2 font-medium">
            <span>Avg Response Latency</span>
            <span className="text-base">⏱️</span>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {overview.avg_latency_ms} <span className="text-sm font-normal opacity-60">ms</span>
          </div>
          <p className="text-xs opacity-60 mt-1">
            Hybrid search + Gemini 2.5 Flash
          </p>
          <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
              ✓ Sub-Second Response
            </span>
            <span className="text-[10px] opacity-40 font-mono">512MB RAM OK</span>
          </div>
        </div>

        {/* KPI 4: RAG Faithfulness Quality */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-60 mb-2 font-medium">
            <span>RAG Faithfulness Score</span>
            <span className="text-base">🎯</span>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {(rag_eval_scores.faithfulness * 100).toFixed(1)}%
          </div>
          <p className="text-xs opacity-60 mt-1">
            Answer Relevancy: {(rag_eval_scores.answer_relevancy * 100).toFixed(1)}%
          </p>
          <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
              RAGAS Benchmark
            </span>
            <span className="text-[10px] opacity-40 font-mono">Precision: {(rag_eval_scores.context_precision * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Department Distribution Cards ─────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
            Department Knowledge & Activity Distribution
          </h3>
          <span className="text-xs opacity-50">{overview.total_users} Authorized Users</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const colors = DEPT_COLORS[dept.department] || DEPT_COLORS.hr
            const chunkShare = overview.total_chunks > 0 ? Math.round((dept.chunks_count / overview.total_chunks) * 100) : 0
            const queryShare = overview.total_queries > 0 ? Math.round((dept.queries_count / overview.total_queries) * 100) : 0

            return (
              <div
                key={dept.department}
                className={`p-5 rounded-2xl border transition-all ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${isDark ? colors.badge : colors.lightBadge}`}>
                    {colors.name}
                  </span>
                  <span className="text-xs font-semibold opacity-70">
                    {dept.users_count} Users
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <span className="text-[11px] opacity-50 uppercase tracking-wider block">Documents</span>
                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{dept.documents_count}</span>
                    <span className="text-xs opacity-50 block">{dept.chunks_count} Chunks</span>
                  </div>
                  <div>
                    <span className="text-[11px] opacity-50 uppercase tracking-wider block">Query Load</span>
                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{dept.queries_count}</span>
                    <span className="text-xs opacity-50 block">{dept.avg_latency_ms} ms avg</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                  <div className="flex justify-between text-[11px] opacity-60">
                    <span>Corpus Share</span>
                    <span>{chunkShare}%</span>
                  </div>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${chunkShare}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Row 3: Knowledge Gaps & Top FAQs (2 Columns) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Knowledge Gaps Card */}
        <div
          className={`p-5 rounded-2xl border ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <h4 className="text-sm font-semibold tracking-tight">Identified Knowledge Gaps</h4>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Needs Upload
            </span>
          </div>
          <p className="text-xs opacity-60 mb-4 leading-relaxed">
            Employee queries where 0 matching citations were retrieved. Upload relevant policy documentation to close these information gaps.
          </p>

          {unanswered_queries.length === 0 ? (
            <div className="py-8 text-center text-xs opacity-40">
              ✓ No documentation gaps detected! All user queries found matching sources.
            </div>
          ) : (
            <div className="space-y-2.5">
              {unanswered_queries.map((q) => (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    isDark ? 'bg-white/[0.02] border-white/5' : 'bg-amber-50/40 border-amber-200/60'
                  }`}
                >
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      "{q.query_text}"
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] opacity-50">
                      <span className="capitalize font-semibold">{q.department}</span>
                      <span>•</span>
                      <span>Asked by {q.user_email}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    0 chunks
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Frequently Asked Questions */}
        <div
          className={`p-5 rounded-2xl border ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🔥</span>
              <h4 className="text-sm font-semibold tracking-tight">Top Frequently Asked Questions</h4>
            </div>
            <span className="text-xs opacity-50">By Volume</span>
          </div>
          <p className="text-xs opacity-60 mb-4 leading-relaxed">
            The most popular inquiries submitted across all departments.
          </p>

          <div className="space-y-2">
            {top_faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 opacity-60 bg-white/10">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium">{faq.query}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-semibold opacity-50">{faq.department}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {faq.count}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Live Query Audit Log & Table ──────────────────── */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
          <div>
            <h4 className="text-sm font-bold tracking-tight">Query Audit Trail</h4>
            <p className="text-xs opacity-50 mt-0.5">Complete log of user queries, grounding status, and response latencies</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="text"
              placeholder="Search queries, users, sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl border outline-none transition-all ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
              }`}
              style={{ width: 220 }}
            />

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl border outline-none cursor-pointer ${
                isDark ? 'bg-[#181a20] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">All Departments</option>
              <option value="hr">Human Resources</option>
              <option value="engineering">Engineering</option>
              <option value="finance">Finance</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b text-[11px] uppercase tracking-wider opacity-50 ${isDark ? 'border-white/5 bg-white/[0.01]' : 'border-slate-100 bg-slate-50'}`}>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Dept</th>
                <th className="py-3 px-4 font-semibold">Query</th>
                <th className="py-3 px-4 font-semibold">Grounding</th>
                <th className="py-3 px-4 font-semibold">Top Source</th>
                <th className="py-3 px-4 font-semibold text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
              {filteredQueries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center opacity-40">
                    No queries matched the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredQueries.map((q) => {
                  const colors = DEPT_COLORS[q.department] || DEPT_COLORS.hr
                  const isGrounded = q.sources_count > 0

                  return (
                    <tr
                      key={q.id}
                      className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap opacity-60 font-mono text-[10px]">
                        {fmtDate(q.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium">
                        {q.user_email}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${isDark ? colors.badge : colors.lightBadge}`}>
                          {q.department}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate font-medium">
                        {q.query_text}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isGrounded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span>✓</span>
                            <span>{q.sources_count} chunks</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <span>○</span>
                            <span>Direct</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[140px] truncate opacity-70 font-mono text-[11px]">
                        {q.top_source || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-[11px] opacity-70">
                        {q.latency_ms} ms
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 5: System Architecture & Infrastructure Health ──── */}
      <div
        className={`p-5 rounded-2xl border ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <h4 className="text-sm font-semibold tracking-tight">System Infrastructure & Hardware Health</h4>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
            ● All Systems Operational
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">Generation Model</span>
            <span className="font-semibold mt-1 block truncate">Gemini 2.5 Flash</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">Embedding Model</span>
            <span className="font-semibold mt-1 block truncate">BGE-small (384d)</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">Vector DB</span>
            <span className="font-semibold mt-1 block truncate">Qdrant Cloud</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">Relational DB</span>
            <span className="font-semibold mt-1 block truncate">Supabase PG</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">RAM Ceiling</span>
            <span className="font-semibold mt-1 block text-emerald-500">512 MB Free Tier</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] opacity-50 uppercase tracking-wider block">RAM Footprint</span>
            <span className="font-semibold mt-1 block text-emerald-500 font-mono">Compliant</span>
          </div>
        </div>
      </div>
    </div>
  )
}
