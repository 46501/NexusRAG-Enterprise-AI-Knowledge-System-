import { useState, useEffect } from 'react'
import {
  runComplianceAudit,
  runRiskAssessment,
  runPolicyIntelligence,
  runAgentCollaboration,
} from '../services/agents'

const PERSONAS = [
  {
    id: 'auditor',
    name: 'Compliance Auditor',
    badge: 'COMPLIANCE',
    icon: '🏛️',
    desc: 'Audit actions and expenditures for Pass/Warn/Fail policy conformity.',
  },
  {
    id: 'risk',
    name: 'Risk Assessor',
    badge: 'LEGAL & RISK',
    icon: '⚖️',
    desc: 'Identify contractual liabilities, SLA risks, and conflicting clauses.',
  },
  {
    id: 'intelligence',
    name: 'Policy Intelligence',
    badge: 'DOC INTEL',
    icon: '⚡',
    desc: 'Extract executive summaries, obligation matrices, and policy gaps.',
  },
  {
    id: 'collaborative',
    name: 'Executive Council',
    badge: 'DUAL AGENT',
    icon: '🤝',
    desc: 'Harmonize Auditor and Risk Assessor findings into unanimous guidance.',
  },
]

const TEMPLATES = {
  hr: [
    { title: 'Extended Bereavement', text: 'An employee requests 20 consecutive days of bereavement leave with no prior manager notice.' },
    { title: 'Probationary Leave', text: 'An employee in their first 30 days of probation requests 2 weeks of paid personal leave.' },
    { title: 'PTO Carryover', text: 'Can an employee rollover 15 unused PTO days into the following calendar year?' },
  ],
  engineering: [
    { title: 'Friday DB Migration', text: 'An engineer plans to deploy a database schema migration to production on Friday afternoon without a rollback plan.' },
    { title: 'P0 Status Page Delay', text: 'During a P0 outage, skipping customer status page updates to keep engineers focused on debugging.' },
    { title: 'Direct Prod Hotfix', text: 'Pushing an unreviewed hotfix directly to production Kubernetes cluster bypassing CI/CD.' },
  ],
  finance: [
    { title: 'Large Client Dinner', text: 'Expensing a $600 client dinner in New York without obtaining VP written approval prior to the event.' },
    { title: 'Late Expense Filing', text: 'Submitting travel expense receipts 45 days after the completion of a domestic business trip.' },
    { title: 'Personal Card SaaS', text: 'Purchasing an annual cloud software license on a personal credit card without procurement review.' },
  ],
}

export default function AgentSidecarModal({
  isOpen,
  onClose,
  initialScenario = '',
  initialPersona = 'auditor',
  initialDoc = null,
  docs = [],
  userRole = 'hr',
  onOpenReader,
}) {
  const [selectedPersona, setSelectedPersona] = useState(initialPersona)
  const [scenario, setScenario] = useState(initialScenario)
  const [focusDoc, setFocusDoc] = useState(initialDoc)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Sync props when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialScenario) setScenario(initialScenario)
      if (initialPersona) setSelectedPersona(initialPersona)
      if (initialDoc) setFocusDoc(initialDoc)
    }
  }, [isOpen, initialScenario, initialPersona, initialDoc])

  if (!isOpen) return null

  const templates = TEMPLATES[userRole] || TEMPLATES.hr

  async function handleExecute() {
    if (!scenario.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      setStage('Retrieving grounded departmental documents...')
      await new Promise((r) => setTimeout(r, 400))

      if (selectedPersona === 'auditor') {
        setStage('Executing Policy Compliance Auditor cross-examination...')
        const res = await runComplianceAudit({
          scenario,
          department: userRole,
          focusDoc: focusDoc || undefined,
        })
        setResult({ type: 'auditor', data: res })
      } else if (selectedPersona === 'risk') {
        setStage('Evaluating contractual, SLA, and operational risk vectors...')
        const res = await runRiskAssessment({
          scenario,
          department: userRole,
          focusDoc: focusDoc || undefined,
        })
        setResult({ type: 'risk', data: res })
      } else if (selectedPersona === 'intelligence') {
        setStage('Analyzing document structure, obligations, and policy gaps...')
        const res = await runPolicyIntelligence({
          scenario,
          department: userRole,
          focusDoc: focusDoc || undefined,
        })
        setResult({ type: 'intelligence', data: res })
      } else if (selectedPersona === 'collaborative') {
        setStage('Running concurrent Auditor and Risk Assessor evaluation...')
        const res = await runAgentCollaboration({
          scenario,
          department: userRole,
          focusDoc: focusDoc || undefined,
        })
        setResult({ type: 'collaborative', data: res })
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete agent workflow. Please try again.')
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  function handleCopyMemo() {
    if (!result?.data?.raw_markdown && !result?.data?.collaborative_synthesis) return
    const textToCopy = result.data.raw_markdown || result.data.collaborative_synthesis
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xl">
              🤖
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Enterprise Multi-Agent Workflows</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Tier 2 Next-Gen
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous governance, compliance auditing & risk assessment sidecars</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Persona Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-950/40 border-b border-slate-800">
          {PERSONAS.map((p) => {
            const active = selectedPersona === p.id
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPersona(p.id)
                  setResult(null)
                  setError(null)
                }}
                className={`flex flex-col items-start p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  active
                    ? 'bg-purple-900/20 border-purple-500/50 shadow-sm shadow-purple-500/10'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-lg">{p.icon}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      active ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
                <div className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{p.name}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Input Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Scenario, Question, or Policy to Analyze</span>
                <span className="text-rose-400">*</span>
              </label>

              {/* Optional Target Document Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Target Document:</span>
                <select
                  value={focusDoc || ''}
                  onChange={(e) => setFocusDoc(e.target.value || null)}
                  className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">All Department Documents</option>
                  {docs.map((d) => (
                    <option key={d.id || d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              rows={3}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g. Can an employee take 20 consecutive days of bereavement leave with no prior notice?"
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-hidden resize-none transition-all"
            />

            {/* Department Template Quick Starter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick Starters:</span>
              {templates.map((tpl, idx) => (
                <button
                  key={idx}
                  onClick={() => setScenario(tpl.text)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-all cursor-pointer truncate max-w-xs"
                  title={tpl.text}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Analysis grounds strictly in {userRole.toUpperCase()} departmental corpus.
            </span>
            <button
              onClick={handleExecute}
              disabled={loading || !scenario.trim()}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>{stage || 'Analyzing...'}</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Execute {PERSONAS.find((p) => p.id === selectedPersona)?.name}</span>
                </>
              )}
            </button>
          </div>

          {/* Loading Animation Card */}
          {loading && (
            <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex flex-col items-center justify-center space-y-3 animate-pulse">
              <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-semibold text-purple-200">{stage}</div>
              <div className="text-xs text-purple-400/80">Cross-examining grounded clauses & synthesizing governance report</div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Results View */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pt-2 border-t border-slate-800">
              
              {/* Verdict Header */}
              {result.type === 'auditor' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg border ${
                        result.data.verdict === 'COMPLIANT'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : result.data.verdict === 'CONDITIONAL'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : result.data.verdict === 'VIOLATION'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {result.data.verdict}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-white">Compliance Audit Verdict</div>
                      <div className="text-xs text-slate-400">Confidence: {result.data.confidence_score}%</div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMemo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{copied ? '✅ Copied' : '📋 Copy Memo'}</span>
                  </button>
                </div>
              )}

              {result.type === 'risk' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg border ${
                        result.data.risk_level === 'LOW'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : result.data.risk_level === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {result.data.risk_level} RISK
                    </span>
                    <div>
                      <div className="text-sm font-bold text-white">Operational & Legal Risk Assessment</div>
                      <div className="text-xs text-slate-400">Confidence: {result.data.confidence_score}%</div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMemo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{copied ? '✅ Copied' : '📋 Copy Memo'}</span>
                  </button>
                </div>
              )}

              {result.type === 'collaborative' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-purple-950/30 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤝</span>
                    <div>
                      <div className="text-sm font-bold text-white">Executive Council Joint Consensus</div>
                      <div className="text-xs text-purple-300">
                        Auditor: {result.data.auditor_report.verdict} | Risk: {result.data.risk_report.risk_level}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMemo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{copied ? '✅ Copied' : '📋 Copy Consensus'}</span>
                  </button>
                </div>
              )}

              {/* Executive Summary Section */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Executive Summary</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.data.executive_summary || result.data.collaborative_synthesis}
                </p>
              </div>

              {/* Rule Checks for Auditor */}
              {result.type === 'auditor' && result.data.rules_checked?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Evaluated Policy Rules</div>
                  <div className="grid gap-2">
                    {result.data.rules_checked.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3 text-xs">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'PASS'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : r.status === 'WARN'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {r.status}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="font-semibold text-white">{r.rule}</div>
                          <div className="text-slate-300">{r.finding}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Vectors for Risk Assessor */}
              {result.type === 'risk' && result.data.risk_vectors?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Primary Risk Vectors</div>
                  <div className="grid gap-2">
                    {result.data.risk_vectors.map((v, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3 text-xs">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            v.severity === 'LOW'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : v.severity === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {v.severity}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="font-semibold text-white">{v.vector_name}</div>
                          <div className="text-slate-300">{v.description}</div>
                          {v.impacted_stakeholders?.length > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Impacted: {v.impacted_stakeholders.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Policy Intelligence Breakdown */}
              {result.type === 'intelligence' && (
                <div className="space-y-4">
                  {result.data.executive_takeaways?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Key Takeaways</div>
                      <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                        {result.data.executive_takeaways.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.data.enforcement_matrix?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Enforcement Matrix</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
                          <thead className="bg-slate-800/60 text-slate-300">
                            <tr>
                              <th className="p-2 font-semibold">Role</th>
                              <th className="p-2 font-semibold">Obligation</th>
                              <th className="p-2 font-semibold">Timeline / Limit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {result.data.enforcement_matrix.map((m, idx) => (
                              <tr key={idx} className="hover:bg-slate-850">
                                <td className="p-2 font-medium text-purple-300">{m.role}</td>
                                <td className="p-2 text-slate-300">{m.obligation}</td>
                                <td className="p-2 text-slate-400">{m.threshold_or_timeline}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Unanimous Recommendations for Collaborative */}
              {result.type === 'collaborative' && result.data.unanimous_recommendations?.length > 0 && (
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                  <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Unanimous Executive Council Recommendations
                  </div>
                  <ul className="list-decimal pl-4 text-xs text-slate-200 space-y-1.5">
                    {result.data.unanimous_recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Required Approvals & Remediation */}
              {result.data.required_approvals?.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">Required Sign-Offs & Approvals:</div>
                  <div className="text-purple-300">{result.data.required_approvals.join(', ')}</div>
                </div>
              )}

              {result.data.remediation_steps?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Required Remediation Actions</div>
                  <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                    {result.data.remediation_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Citations and Sources */}
              {result.data.sources?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grounded Source Clauses</div>
                  <div className="flex flex-wrap gap-2">
                    {result.data.sources.map((src, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (onOpenReader) {
                            onOpenReader({
                              docIdOrName: src.source,
                              snippet: src.snippet,
                            })
                          }
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                        title={src.snippet}
                      >
                        <span className="font-bold text-purple-400">[{src.index}]</span>
                        <span className="font-medium truncate max-w-[180px]">{src.source}</span>
                        {src.section && <span className="text-slate-500 text-[10px]">({src.section})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">Specialist Agents Ready (Gemini 3.5 Flash-Lite Active)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

