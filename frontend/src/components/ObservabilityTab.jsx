import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  fetchObservabilityOverview,
  triggerContinuousEval,
  fetchEvalStatus,
  setEvalScheduleInterval,
} from '../services/observability'

export default function ObservabilityTab({ isDemoAdmin = false }) {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [evalStarting, setEvalStarting] = useState(false)
  const [evalPolling, setEvalPolling] = useState(false)
  const [evalStatusInfo, setEvalStatusInfo] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchObservabilityOverview()
      setData(res)
      if (res?.eval_status?.is_running) {
        setEvalPolling(true)
      }
    } catch (err) {
      console.error('Failed to load observability telemetry', err)
      setError(err.response?.data?.detail || 'Failed to load observability overview.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Poll eval status while running
  useEffect(() => {
    if (!evalPolling) return
    const interval = setInterval(async () => {
      try {
        const st = await fetchEvalStatus()
        setEvalStatusInfo(st)
        if (!st.is_running) {
          setEvalPolling(false)
          clearInterval(interval)
          loadData()
        }
      } catch (err) {
        console.error('Eval polling error', err)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [evalPolling, loadData])

  async function handleTriggerEval() {
    if (isDemoAdmin || evalStarting || evalPolling) return
    setEvalStarting(true)
    try {
      await triggerContinuousEval()
      setEvalPolling(true)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to trigger evaluation run.')
    } finally {
      setEvalStarting(false)
    }
  }

  async function handleScheduleChange(newInterval) {
    if (isDemoAdmin) return
    try {
      await setEvalScheduleInterval(newInterval)
      loadData()
    } catch (err) {
      console.error('Failed to update schedule', err)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div
          className={`h-6 w-6 rounded-full border-2 animate-spin ${
            isDark ? 'border-white/20 border-t-purple-400' : 'border-slate-300 border-t-purple-600'
          }`}
        />
        <span className="text-xs opacity-60">Synthesizing Tier 3 Observability & Drift Telemetry...</span>
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
        <p className="font-semibold text-sm">Observability Service Unavailable</p>
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

  const drift = data?.overview?.drift || {}
  const regression = data?.regression || {}
  const metrics = regression?.metrics || []
  const overallStatus = drift?.overall_status || 'HEALTHY'
  const grounding = drift?.grounding || {}
  const latency = drift?.latency || {}
  const sentiment = drift?.sentiment || {}
  const topicGaps = drift?.topic_gaps || []
  const diagnostics = drift?.diagnostics || []
  const recommendations = drift?.recommendations || []
  const currentInterval = regression?.schedule_interval || 'manual'

  const statusConfig = {
    HEALTHY: {
      label: 'Optimal — All SLAs Compliant',
      color: 'text-emerald-400',
      bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      border: isDark ? 'border-emerald-500/25' : 'border-emerald-200',
      dot: 'bg-emerald-400',
    },
    DRIFT_DETECTED: {
      label: 'Telemetry Drift Detected',
      color: 'text-amber-400',
      bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
      border: isDark ? 'border-amber-500/25' : 'border-amber-200',
      dot: 'bg-amber-400',
    },
    CRITICAL_REGRESSION: {
      label: 'Critical SLA Regression',
      color: 'text-rose-400',
      bg: isDark ? 'bg-rose-500/10' : 'bg-rose-50',
      border: isDark ? 'border-rose-500/25' : 'border-rose-200',
      dot: 'bg-rose-400',
    },
  }[overallStatus] || {
    label: overallStatus,
    color: 'text-sky-400',
    bg: isDark ? 'bg-sky-500/10' : 'bg-sky-50',
    border: isDark ? 'border-sky-500/25' : 'border-sky-200',
    dot: 'bg-sky-400',
  }

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER & CONTROLS ───────────────────────────── */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900/90 via-purple-950/20 to-slate-900/90 border-white/10'
            : 'bg-gradient-to-r from-white via-purple-50/40 to-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🏛️</span>
              <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Enterprise Observability & Continuous Eval Loop
              </h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-800'
                }`}
              >
                Tier 3 Engine
              </span>
            </div>
            <p className={`mt-1 text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
              Continuous regression monitoring, sliding-window telemetry drift, and dual-engine LLM-as-a-judge scoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scheduled Interval Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`text-[11px] font-medium ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                Interval:
              </span>
              <select
                value={currentInterval}
                disabled={isDemoAdmin}
                onChange={(e) => handleScheduleChange(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                  isDark
                    ? 'bg-white/5 border-white/15 text-white/90 hover:bg-white/10'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <option value="manual">Manual Trigger</option>
                <option value="6h">Every 6 Hours</option>
                <option value="12h">Every 12 Hours</option>
                <option value="24h">Daily (24h)</option>
              </select>
            </div>

            {/* Run Eval Button */}
            <button
              onClick={handleTriggerEval}
              disabled={isDemoAdmin || evalStarting || evalPolling}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                evalPolling
                  ? 'bg-purple-600 text-white opacity-80 cursor-wait'
                  : isDark
                  ? 'bg-purple-600 hover:bg-purple-500 text-white hover:scale-[1.02]'
                  : 'bg-purple-600 hover:bg-purple-700 text-white hover:scale-[1.02]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={isDemoAdmin ? 'Demo accounts have read-only access' : 'Run automated continuous evaluation across golden benchmark test cases'}
            >
              {evalPolling ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Evaluating RAGAS...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run Benchmark Eval</span>
                </>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${
                isDark ? 'border-white/10 bg-white/5 text-white/70 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
              title="Refresh Telemetry"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Real-Time Health & Drift Summary Banner */}
        <div className={`mt-4 rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${statusConfig.bg} ${statusConfig.border}`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full animate-pulse ${statusConfig.dot}`} />
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                {drift?.overall_summary || 'All retrieval grounding, response latency, and user feedback vectors are compliant.'}
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono opacity-60 self-start sm:self-auto">
            Sample: {drift?.query_sample_size || 0} Queries
          </div>
        </div>
      </div>

      {/* ── 3-COLUMN DRIFT TELEMETRY TILES ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Grounding Rate Drift */}
        <div
          className={`rounded-2xl border p-5 transition-all ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-slate-500'} uppercase tracking-wider`}>
              🎯 Grounding Rate Drift
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                grounding?.drift_detected
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {grounding?.drift_detected ? 'DRIFT' : 'COMPLIANT'}
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {grounding?.recent_pct ?? 100}%
            </span>
            <span
              className={`text-xs font-semibold ${
                (grounding?.delta_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {(grounding?.delta_pct ?? 0) >= 0 ? `+${grounding?.delta_pct}%` : `${grounding?.delta_pct}%`} vs SLA
            </span>
          </div>

          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[11px] opacity-60">
              <span>SLA Baseline Target</span>
              <span>{grounding?.baseline_pct ?? 90}%</span>
            </div>
            <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-100'} overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all ${
                  (grounding?.recent_pct ?? 100) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, grounding?.recent_pct ?? 100)}%` }}
              />
            </div>
            <p className={`text-[11px] pt-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              Historical All-Time Grounding: {grounding?.historical_pct ?? 100}%
            </p>
          </div>
        </div>

        {/* 2. Latency Percentiles Drift */}
        <div
          className={`rounded-2xl border p-5 transition-all ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-slate-500'} uppercase tracking-wider`}>
              ⏱️ Latency Percentiles
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                latency?.drift_detected
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {latency?.drift_detected ? 'DRIFT' : 'COMPLIANT'}
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {latency?.recent_stats?.p90 ?? 0}
              <span className="text-base font-normal opacity-50"> ms</span>
            </span>
            <span className="text-xs font-semibold opacity-60">
              P90 Latency
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] opacity-50">P50 (Median)</div>
              <div className="font-mono font-semibold mt-0.5">{latency?.recent_stats?.p50 ?? 0}ms</div>
            </div>
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] opacity-50">Average</div>
              <div className="font-mono font-semibold mt-0.5">{latency?.recent_stats?.avg ?? 0}ms</div>
            </div>
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] opacity-50">P99 Max</div>
              <div className="font-mono font-semibold mt-0.5">{latency?.recent_stats?.p99 ?? 0}ms</div>
            </div>
          </div>
        </div>

        {/* 3. User Sentiment & Negative Feedback Drift */}
        <div
          className={`rounded-2xl border p-5 transition-all ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-slate-500'} uppercase tracking-wider`}>
              👍 User Sentiment Drift
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                sentiment?.drift_detected
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {sentiment?.drift_detected ? 'DRIFT' : 'COMPLIANT'}
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {sentiment?.satisfaction_pct ?? 100}%
            </span>
            <span className="text-xs font-semibold text-emerald-500">
              {sentiment?.positive_count ?? 0} 👍 / {sentiment?.negative_count ?? 0} 👎
            </span>
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="text-[11px] opacity-60 font-medium">Rejection Reasons Breakdown:</div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {Object.entries(sentiment?.reason_breakdown || {}).length > 0 ? (
                Object.entries(sentiment.reason_breakdown).map(([r, cnt]) => (
                  <span
                    key={r}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                      isDark ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {r}: {cnt}
                  </span>
                ))
              ) : (
                <span className="text-[11px] opacity-40">Zero negative rejection flags</span>
              )}
            </div>
            <div className="text-[11px] pt-1 opacity-50">
              Unresolved feedbacks: {sentiment?.unresolved_count ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ── RAGAS REGRESSION SCORECARDS (LLM-AS-A-JUDGE) ─────── */}
      <div
        className={`rounded-2xl border p-6 transition-all ${
          isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">⚖️</span>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                RAGAS Regression Matrix (Native Gemini & OpenAI LLM-as-a-Judge)
              </h3>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
              Evaluated against golden multi-department benchmark test suite. Target SLA thresholds are strictly enforced.
            </p>
          </div>
          <div className="text-xs text-right">
            <span className={`font-mono text-[11px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              Run ID: {regression?.latest_run_id ? regression.latest_run_id.slice(0, 8) + '...' : 'Golden Default'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const pct = Math.round(m.current_score * 100)
            const targetPct = Math.round(m.target_threshold * 100)
            const deltaSign = m.delta >= 0 ? '+' : ''
            const isRegressed = m.is_regressed

            return (
              <div
                key={m.metric_name}
                className={`p-4 rounded-xl border transition-all ${
                  isDark
                    ? isRegressed
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-white/[0.02] border-white/5'
                    : isRegressed
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-slate-50/70 border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
                    {m.metric_name.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      m.is_compliant
                        ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                        : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {m.is_compliant ? 'PASS' : 'REGRESSED'}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {m.current_score.toFixed(3)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      m.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {deltaSign}{m.delta_pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'} overflow-hidden`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        m.is_compliant ? 'bg-purple-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] opacity-50">
                    <span>Target: {targetPct}%</span>
                    <span>Base: {Math.round(m.baseline_score * 100)}%</span>
                  </div>
                </div>

                <p className={`text-[10px] mt-2 line-clamp-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  {m.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── KNOWLEDGE GAP CLUSTERS & ACTIONABLE REMEDIATIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Knowledge Gap Topic Clusters */}
        <div
          className={`rounded-2xl border p-5 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🔍</span>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Knowledge Gap Topic Clusters
              </h3>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                Ungrounded queries and negative feedback automatically grouped into missing policy topics.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {topicGaps.length > 0 ? (
              topicGaps.map((gap, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDark ? 'bg-white/[0.015] border-white/5 hover:border-white/15' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{gap.topic}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                        isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-100 text-purple-700 font-semibold'
                      }`}
                    >
                      {gap.count} Inquiries
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {gap.departments.map((dept) => (
                      <span
                        key={dept}
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          dept === 'hr'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : dept === 'engineering'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {dept}
                      </span>
                    ))}
                  </div>

                  {gap.sample_queries?.length > 0 && (
                    <div className="mt-2 text-[11px] opacity-70 italic line-clamp-1">
                      "{gap.sample_queries[0]}"
                    </div>
                  )}

                  <div className={`mt-2.5 text-[11px] font-medium flex items-center gap-1.5 ${isDark ? 'text-purple-300/80' : 'text-purple-700'}`}>
                    <span>💡 Action:</span>
                    <span>{gap.recommended_action}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={`text-xs text-center py-6 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                Zero knowledge gap clusters detected! All employee inquiries are supported by documentation.
              </p>
            )}
          </div>
        </div>

        {/* Real-time Diagnostics & Operational Recommendations */}
        <div
          className={`rounded-2xl border p-5 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📋</span>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Diagnostics & Proactive Recommendations
              </h3>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                Automated continuous auditing and root-cause diagnoses across system telemetry.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                Telemetry Diagnoses
              </h4>
              <ul className="space-y-1.5 text-xs">
                {diagnostics.map((diag, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span className={isDark ? 'text-white/80' : 'text-slate-700'}>{diag}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                Recommended Operational Actions
              </h4>
              <ul className="space-y-2 text-xs">
                {recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                      isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span className={isDark ? 'text-white/90' : 'text-slate-800'}>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
