import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  fetchKnowledgeOpsOverview,
  scanContradictions,
  generatePolicyDraft,
  publishPolicyDraft,
} from '../services/knowledgeOps'

const QUICK_DRAFT_TEMPLATES = [
  { topic: 'Cryptocurrency & Digital Asset Payments', dept: 'finance', scope: 'Vendor invoicing, corporate gifts, and non-fiat asset guidelines.' },
  { topic: 'Home Office Ergonomic Reimbursement', dept: 'hr', scope: 'Annual allowances for ergonomic chairs, standing desks, and monitors.' },
  { topic: 'Multi-Region Kubernetes Failover Runbook', dept: 'engineering', scope: 'Emergency cross-region traffic shifting and stateful database failover.' },
  { topic: 'Generative AI & LLM Data Protection Standards', dept: 'engineering', scope: 'Authorized use of internal and public AI models with enterprise IP protection.' },
]

export default function KnowledgeOpsTab({ isDemoAdmin = false }) {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Radar state
  const [scanningRadar, setScanningRadar] = useState(false)
  const [radarDepartment, setRadarDepartment] = useState('all')

  // Drafter state
  const [draftTopic, setDraftTopic] = useState('')
  const [draftDept, setDraftDept] = useState('hr')
  const [draftScope, setDraftScope] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchKnowledgeOpsOverview()
      setData(res)
    } catch (err) {
      console.error('Failed to load Knowledge Ops telemetry', err)
      setError(err.response?.data?.detail || 'Failed to load Knowledge Operations data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleScanRadar() {
    setScanningRadar(true)
    try {
      const deptArg = radarDepartment === 'all' ? null : radarDepartment
      const res = await scanContradictions(deptArg)
      setData((prev) => ({
        ...prev,
        contradictions: res,
      }))
    } catch (err) {
      alert(err.response?.data?.detail || 'Contradiction scan failed.')
    } finally {
      setScanningRadar(false)
    }
  }

  async function handleGenerateDraft(e) {
    if (e) e.preventDefault()
    if (!draftTopic.trim() || drafting) return
    setDrafting(true)
    setPublishSuccess(false)
    try {
      const res = await generatePolicyDraft({
        topic: draftTopic,
        department: draftDept,
        scopeDescription: draftScope,
      })
      setDraftResult(res)
    } catch (err) {
      alert(err.response?.data?.detail || 'Draft generation failed.')
    } finally {
      setDrafting(false)
    }
  }

  async function handlePublishDraft() {
    if (isDemoAdmin || !draftResult || publishing) return
    setPublishing(true)
    try {
      await publishPolicyDraft({
        filename: draftResult.filename,
        department: draftResult.department,
        content: draftResult.markdown_content,
      })
      setPublishSuccess(true)
      loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Publishing failed.')
    } finally {
      setPublishing(false)
    }
  }

  function handleApplyTemplate(tmpl) {
    setDraftTopic(tmpl.topic)
    setDraftDept(tmpl.dept)
    setDraftScope(tmpl.scope)
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div
          className={`h-6 w-6 rounded-full border-2 animate-spin ${
            isDark ? 'border-white/20 border-t-emerald-400' : 'border-slate-300 border-t-emerald-600'
          }`}
        />
        <span className="text-xs opacity-60">Synthesizing Tier 4 Knowledge Operations Telemetry...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div
        className={`p-6 rounded-2xl border ${
          isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        <p className="font-semibold text-sm">Knowledge Operations Service Unavailable</p>
        <p className="text-xs mt-1 opacity-80">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white cursor-pointer hover:bg-rose-500"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  const health = data?.health_index || {}
  const radar = data?.contradictions || { items: [] }
  const decayRanking = data?.decay_ranking || []
  const forecast = data?.demand_forecast || []
  const pillars = health?.pillars || {}
  const deptScores = health?.department_scores || {}

  return (
    <div className="space-y-6">
      {/* ── TOP HERO: ENTERPRISE HEALTH INDEX ─────────────────── */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900/90 via-emerald-950/20 to-slate-900/90 border-white/10'
            : 'bg-gradient-to-r from-white via-emerald-50/40 to-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🏆</span>
              <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Enterprise Knowledge Health Index
              </h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                Tier 4 Ops
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-600'} max-w-2xl`}>
              {health?.executive_summary || 'Autonomous self-healing knowledge governance across HR, Engineering, and Finance.'}
            </p>
          </div>

          <div className="flex items-center gap-4 self-start lg:self-auto">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50">Composite Score</div>
              <div className="flex items-baseline gap-1.5 justify-end mt-0.5">
                <span className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {health?.overall_score ?? 90}
                </span>
                <span className="text-xs opacity-50 font-bold">/ 100</span>
              </div>
            </div>
            <div
              className={`px-3 py-2 rounded-xl text-center border font-bold ${
                isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              <div className="text-lg leading-none">{health?.overall_grade || 'A'}</div>
              <div className="text-[9px] uppercase tracking-wider mt-0.5 font-semibold">Rating</div>
            </div>
          </div>
        </div>

        {/* 5 Health Pillars */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5 border-t border-white/5">
          {[
            { label: 'Grounding Rate', val: pillars.grounding_rate, target: 90 },
            { label: 'RAGAS Quality', val: pillars.ragas_quality, target: 85 },
            { label: 'User Satisfaction', val: pillars.user_satisfaction, target: 80 },
            { label: 'Policy Freshness', val: pillars.policy_freshness, target: 80 },
            { label: 'Contradiction Freedom', val: pillars.contradiction_freedom, target: 85 },
          ].map((pil, idx) => (
            <div key={idx} className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex justify-between items-baseline text-[11px]">
                <span className="opacity-60 truncate">{pil.label}</span>
                <span className="font-bold ml-1">{pil.val ?? 90}%</span>
              </div>
              <div className={`mt-1.5 h-1.5 w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    (pil.val ?? 90) >= pil.target ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, pil.val ?? 90)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Department Scorecards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(deptScores).map(([deptKey, d]) => (
            <div
              key={deptKey}
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-white/[0.015] border-white/5' : 'bg-white border-slate-100'
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider">
                  {deptKey === 'hr' ? '👥 Human Resources' : deptKey === 'engineering' ? '⚙️ Engineering' : '💰 Finance'}
                </span>
                <div className="text-[11px] opacity-60 mt-0.5">
                  {d.document_count} Docs · Freshness: {d.freshness_rating}%
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold">{d.health_score}</span>
                <span className="text-[10px] opacity-50 block font-semibold">{d.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ENGINE 1: CONTRADICTION RADAR & ENGINE 4: DEMAND FORECAST ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cross-Policy Contradiction Radar */}
        <div
          className={`rounded-2xl border p-5 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🔍</span>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Cross-Policy Contradiction Radar
                </h3>
                <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                  Automated semantic scan for conflicting rules and mismatched SLA clauses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <select
                value={radarDepartment}
                onChange={(e) => setRadarDepartment(e.target.value)}
                className={`text-xs px-2 py-1 rounded-lg border ${
                  isDark ? 'bg-white/5 border-white/15 text-white/80' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Departments</option>
                <option value="hr">HR</option>
                <option value="engineering">Engineering</option>
                <option value="finance">Finance</option>
              </select>

              <button
                onClick={handleScanRadar}
                disabled={scanningRadar}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                  scanningRadar
                    ? 'bg-amber-600 text-white opacity-70 cursor-wait'
                    : 'bg-amber-600 hover:bg-amber-500 text-white hover:scale-105'
                }`}
              >
                {scanningRadar ? 'Scanning...' : 'Scan Radar'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {radar.items && radar.items.length > 0 ? (
              radar.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDark ? 'bg-white/[0.015] border-white/5 hover:border-white/15' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-2">
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {item.department}
                      </span>
                      <span>{item.issue}</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.severity === 'critical'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          : item.severity === 'high'
                          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className={`p-2 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200'}`}>
                      <div className="font-semibold text-purple-400 mb-0.5">📄 {item.document_a}</div>
                      <div className="opacity-70 italic line-clamp-2">"{item.clause_a}"</div>
                    </div>
                    <div className={`p-2 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200'}`}>
                      <div className="font-semibold text-sky-400 mb-0.5">📄 {item.document_b}</div>
                      <div className="opacity-70 italic line-clamp-2">"{item.clause_b}"</div>
                    </div>
                  </div>

                  <div className={`mt-2.5 text-[11px] font-medium flex items-start gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    <span className="font-bold">💡 Recommended Fix:</span>
                    <span>{item.recommended_resolution}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={`text-xs text-center py-8 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                Zero policy contradictions detected across all department manuals.
              </p>
            )}
          </div>
        </div>

        {/* Predictive Knowledge Demand Forecast */}
        <div
          className={`rounded-2xl border p-5 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📈</span>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                30-Day Predictive Knowledge Demand
              </h3>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                Forecasts upcoming employee inquiries based on organizational calendar milestones.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {forecast.map((fc, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-white/[0.015] border-white/5' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        fc.department === 'hr'
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : fc.department === 'engineering'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {fc.department}
                    </span>
                    <span className="text-xs font-bold">{fc.predicted_surge_topic}</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-500">
                    +{fc.expected_query_increase_pct}% Traffic
                  </span>
                </div>

                <div className={`mt-2 text-[11px] ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                  <span className="font-semibold opacity-60">Driver: </span>
                  {fc.business_driver}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 block mb-1">
                    Operational Preparation Checklist:
                  </span>
                  <ul className="space-y-1 text-[11px]">
                    {fc.preparation_checklist.map((check, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 opacity-85">
                        <span className="text-emerald-500">✓</span>
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ENGINE 3: AUTONOMOUS POLICY DRAFTER & INGESTION ──── */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-xl">📝</span>
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Autonomous Policy Gap Drafter & Self-Healing Ingestion
            </h3>
            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
              Autonomously synthesizes standardized corporate SOPs for ungrounded knowledge topics and ingests them directly.
            </p>
          </div>
        </div>

        {/* Quick template chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] opacity-50 font-medium">Quick Gap Starters:</span>
          {QUICK_DRAFT_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyTemplate(tmpl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer hover:scale-105 ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              + {tmpl.topic}
            </button>
          ))}
        </div>

        {/* Draft input form */}
        <form onSubmit={handleGenerateDraft} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <input
              type="text"
              placeholder="Policy Topic (e.g. Remote Ergonomic Equipment Allowance)"
              value={draftTopic}
              onChange={(e) => setDraftTopic(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-xl text-xs border focus:outline-none ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-emerald-500/50'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              }`}
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={draftDept}
              onChange={(e) => setDraftDept(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500'
              }`}
            >
              <option value="hr">HR</option>
              <option value="engineering">Engineering</option>
              <option value="finance">Finance</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={!draftTopic.trim() || drafting}
              className={`w-full py-2 px-4 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                drafting
                  ? 'bg-emerald-600 text-white opacity-70 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {drafting ? 'Generating Policy Standard...' : '⚡ Generate Policy Draft'}
            </button>
          </div>
        </form>

        {/* Draft result preview */}
        {draftResult && (
          <div
            className={`mt-5 p-5 rounded-2xl border transition-all ${
              isDark ? 'bg-white/[0.015] border-white/10' : 'bg-slate-50 border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>📄 {draftResult.title}</span>
                  <span className="text-[10px] font-mono opacity-60">({draftResult.filename})</span>
                </h4>
                <div className="text-[11px] opacity-60 mt-0.5">
                  Effective: {draftResult.effective_date} · Dept: {draftResult.department.toUpperCase()} · ~{draftResult.estimated_chunks} Chunks
                </div>
              </div>

              <div className="flex items-center gap-2">
                {publishSuccess ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    ✓ Published & Ingested to {draftResult.department.toUpperCase()}
                  </span>
                ) : (
                  <button
                    onClick={handlePublishDraft}
                    disabled={isDemoAdmin || publishing}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ${
                      publishing
                        ? 'bg-purple-600 text-white opacity-70 cursor-wait'
                        : isDemoAdmin
                        ? 'bg-slate-500 text-white opacity-40 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white hover:scale-105'
                    }`}
                    title={isDemoAdmin ? 'Demo accounts have read-only access' : 'Ingest draft directly into Qdrant & Postgres'}
                  >
                    {publishing ? 'Publishing & Chunking...' : '🚀 Publish to Ingestion'}
                  </button>
                )}
              </div>
            </div>

            {/* Key rules chips */}
            <div className="mt-3.5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-bold opacity-50">Rules Extracted:</span>
              {draftResult.key_rules?.map((rule, idx) => (
                <span
                  key={idx}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    isDark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  ✓ {rule}
                </span>
              ))}
            </div>

            {/* Markdown Text Area */}
            <div className="mt-3.5">
              <textarea
                readOnly
                value={draftResult.markdown_content}
                rows={10}
                className={`w-full p-3.5 rounded-xl font-mono text-xs border focus:outline-none leading-relaxed ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white/80'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── ENGINE 2: DOCUMENT FRESHNESS & VELOCITY LEADERBOARD ── */}
      <div
        className={`rounded-2xl border p-5 ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">⏳</span>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Document Freshness & Obsolescence Risk Leaderboard
              </h3>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                Identifies decaying policies correlated with negative user feedback or low verification velocity.
              </p>
            </div>
          </div>
          <span className="text-[11px] opacity-50 font-mono">
            Tracking {decayRanking.length} Documents
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/10' : 'border-slate-200 bg-slate-50/70'}`}>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Document</th>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Dept</th>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Velocity</th>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Negative Complaints</th>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Freshness</th>
                <th className={`px-4 py-2.5 text-left font-semibold ${isDark ? 'text-white/40' : 'text-slate-500'} uppercase tracking-wide`}>Risk Factors</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/[0.05]' : 'divide-slate-100'}`}>
              {decayRanking.map((doc, idx) => (
                <tr key={idx} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-4 py-3 font-semibold truncate max-w-[200px]" title={doc.document_name}>
                    📄 {doc.document_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        doc.department === 'hr'
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : doc.department === 'engineering'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {doc.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono opacity-80">
                    {doc.query_velocity} queries
                  </td>
                  <td className="px-4 py-3">
                    {doc.negative_feedback_count > 0 ? (
                      <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        {doc.negative_feedback_count} complaints
                      </span>
                    ) : (
                      <span className="opacity-40">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{doc.freshness_score}%</span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          doc.freshness_label === 'Fresh'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : doc.freshness_label === 'Degrading'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {doc.freshness_label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 opacity-70 line-clamp-1 max-w-[280px]">
                    {doc.staleness_risk_factors?.[0] || 'Active & healthy'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
