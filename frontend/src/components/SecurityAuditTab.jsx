import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  fetchSecuritySummary,
  fetchSecurityLogs,
  unlockUserAccount,
  revokeAllUserSessions,
} from '../services/security'

const SEVERITY_STYLES = {
  CRITICAL: {
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    lightBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  HIGH: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    lightBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  MEDIUM: {
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    lightBadge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  LOW: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    lightBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  INFO: {
    badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    lightBadge: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
  },
}

const EVENT_TYPE_LABELS = {
  PROMPT_INJECTION_BLOCKED: { label: 'Prompt Injection Blocked', icon: '🛡️' },
  PII_REDACTED: { label: 'PII & Secret Masked', icon: '🕵️' },
  UNAUTHORIZED_ACCESS_403: { label: '403 RBAC Violation', icon: '🚫' },
  ACCOUNT_LOCKED: { label: 'Brute-Force Lockout', icon: '🔒' },
  FAILED_LOGIN: { label: 'Failed Login', icon: '⚠️' },
  TOKEN_REVOKED: { label: 'Session Revoked', icon: '🔑' },
  ACCOUNT_UNLOCKED: { label: 'Account Restored', icon: '🔓' },
  USER_DEACTIVATED: { label: 'User Suspended', icon: '⛔' },
}

export default function SecurityAuditTab({ isDemoAdmin = false }) {
  const { isDark } = useTheme()
  const [summary, setSummary] = useState(null)
  const [logs, setLogs] = useState([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [selectedSeverity, setSelectedSeverity] = useState('')
  const [selectedEventType, setSelectedEventType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Quick Action States
  const [unlockEmail, setUnlockEmail] = useState('')
  const [unlockStatus, setUnlockStatus] = useState(null)
  const [revokeUserId, setRevokeUserId] = useState('')
  const [revokeStatus, setRevokeStatus] = useState(null)

  // Expanded log item for detail inspection
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumData, logsData] = await Promise.all([
        fetchSecuritySummary(),
        fetchSecurityLogs({
          eventType: selectedEventType || null,
          severity: selectedSeverity || null,
          search: searchQuery || '',
          limit: 50,
          offset: 0,
        }),
      ])
      setSummary(sumData)
      setLogs(logsData.items || [])
      setTotalLogs(logsData.total || 0)
    } catch (err) {
      console.error('Failed to load security audit data:', err)
      setError('Could not load security audit metrics. Ensure backend is running and you have Admin access.')
    } finally {
      setLoading(false)
    }
  }, [selectedEventType, selectedSeverity, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleUnlock(e) {
    e.preventDefault()
    if (!unlockEmail.trim()) return
    setUnlockStatus({ type: 'loading', message: 'Unlocking account...' })
    try {
      const res = await unlockUserAccount(unlockEmail.trim())
      setUnlockStatus({ type: 'success', message: res.message || 'Account unlocked successfully.' })
      setUnlockEmail('')
      loadData()
    } catch (err) {
      setUnlockStatus({ type: 'error', message: err.response?.data?.detail || 'Failed to unlock account.' })
    }
  }

  async function handleRevoke(e) {
    e.preventDefault()
    if (!revokeUserId.trim()) return
    setRevokeStatus({ type: 'loading', message: 'Revoking sessions...' })
    try {
      const res = await revokeAllUserSessions(revokeUserId.trim())
      setRevokeStatus({ type: 'success', message: res.message || 'Sessions revoked successfully.' })
      setRevokeUserId('')
      loadData()
    } catch (err) {
      setRevokeStatus({ type: 'error', message: err.response?.data?.detail || 'Failed to revoke sessions.' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-gradient-to-r from-red-950/20 via-neutral-900 to-amber-950/20 border-red-500/20'
            : 'bg-gradient-to-r from-red-50 via-white to-amber-50 border-red-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-2xl border border-red-500/20">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                  Enterprise Security & AI Defense Console
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  Tier 5 Hardened
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Real-time SIEM audit trail tracking prompt injection firewall blocks, PII/secret scrubbing, RBAC violations, and brute-force defenses.
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all self-start md:self-center ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300'
            }`}
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh Telemetry
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={loadData} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: 24h & 7d Events */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Security Events (7d)
            </span>
            <span className="text-base">📊</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              {summary ? summary.total_7d : '—'}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              +{summary?.total_events_24h || 0} (24h)
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Audit events captured across all services
          </p>
        </div>

        {/* Card 2: Critical Threats */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Critical Threats
            </span>
            <span className="text-base">🚨</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${summary?.critical_events_7d > 0 ? 'text-rose-400' : isDark ? 'text-white' : 'text-neutral-900'}`}>
              {summary ? summary.critical_events_7d : '—'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
              Intercepted
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            System overrides, jailbreaks & account locks
          </p>
        </div>

        {/* Card 3: PII & Secrets Scrubbed */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              PII & Secrets Scrubbed
            </span>
            <span className="text-base">🕵️</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              {summary?.event_type_breakdown?.PII_REDACTED || 0}
            </span>
            <span className="text-xs text-sky-400 font-medium">Masked in Real-Time</span>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            SSNs, credit cards, API keys & passwords
          </p>
        </div>

        {/* Card 4: Active Lockouts & Revocations */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Active Protections
            </span>
            <span className="text-base">🔒</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <span className={`text-xl font-bold tracking-tight ${summary?.active_locked_accounts > 0 ? 'text-amber-400' : isDark ? 'text-white' : 'text-neutral-900'}`}>
                {summary?.active_locked_accounts || 0}
              </span>
              <span className="text-[10px] ml-1 text-neutral-400">Locked</span>
            </div>
            <div>
              <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {summary?.active_revoked_tokens || 0}
              </span>
              <span className="text-[10px] ml-1 text-neutral-400">Revoked</span>
            </div>
          </div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Auto-expiring blacklist & brute-force limits
          </p>
        </div>
      </div>

      {/* Security Operations Quick-Action Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unlock Account Tool */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <span>🔓</span> Manual Account Unlock
          </h3>
          <p className={`text-xs mt-1 mb-3 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Immediately reset brute-force attempt counters and clear lockout for a user email.
          </p>
          <form onSubmit={handleUnlock} className="flex gap-2">
            <input
              type="email"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              placeholder="user@example.com"
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 ${
                isDark
                  ? 'bg-neutral-950 border-neutral-700 text-white placeholder-neutral-500 focus:ring-red-500'
                  : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:ring-red-500'
              }`}
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Unlock
            </button>
          </form>
          {unlockStatus && (
            <p className={`text-xs mt-2 ${unlockStatus.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {unlockStatus.message}
            </p>
          )}
        </div>

        {/* Emergency Session Revocation Tool */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
          }`}
        >
          <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <span>⛔</span> Emergency Session Revocation
          </h3>
          <p className={`text-xs mt-1 mb-3 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Instantly terminate all active tokens across all devices for a given User UUID.
          </p>
          <form onSubmit={handleRevoke} className="flex gap-2">
            <input
              type="text"
              value={revokeUserId}
              onChange={(e) => setRevokeUserId(e.target.value)}
              placeholder="User UUID (e.g. 15560980-...)"
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 ${
                isDark
                  ? 'bg-neutral-950 border-neutral-700 text-white placeholder-neutral-500 focus:ring-red-500'
                  : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:ring-red-500'
              }`}
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors"
            >
              Revoke All
            </button>
          </form>
          {revokeStatus && (
            <p className={`text-xs mt-2 ${revokeStatus.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {revokeStatus.message}
            </p>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs border focus:outline-none ${
                isDark
                  ? 'bg-neutral-950 border-neutral-700 text-neutral-200'
                  : 'bg-white border-neutral-300 text-neutral-700'
              }`}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
              <option value="INFO">INFO</option>
            </select>

            {/* Event Type Filter */}
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs border focus:outline-none ${
                isDark
                  ? 'bg-neutral-950 border-neutral-700 text-neutral-200'
                  : 'bg-white border-neutral-300 text-neutral-700'
              }`}
            >
              <option value="">All Threat Types</option>
              <option value="PROMPT_INJECTION_BLOCKED">Prompt Injections</option>
              <option value="PII_REDACTED">PII & Secrets</option>
              <option value="UNAUTHORIZED_ACCESS_403">RBAC Violations (403)</option>
              <option value="ACCOUNT_LOCKED">Account Lockouts</option>
              <option value="TOKEN_REVOKED">Token Revocations</option>
            </select>

            {(selectedSeverity || selectedEventType || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedSeverity('')
                  setSelectedEventType('')
                  setSearchQuery('')
                }}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, IP, or summary..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 ${
                isDark
                  ? 'bg-neutral-950 border-neutral-700 text-white placeholder-neutral-500 focus:ring-red-500'
                  : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:ring-red-500'
              }`}
            />
            <span className="absolute left-2.5 top-2 text-xs text-neutral-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Security Audit Log Table */}
      <div
        className={`rounded-xl border overflow-hidden transition-all ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              Security Audit Trail ({totalLogs} recorded)
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Forensic timeline of intercepted attacks, unauthorized accesses, and compliance events
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl">🛡️</span>
            <p className={`text-sm font-medium mt-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
              No matching security events found
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              All systems operating normally with zero detected threats for the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${isDark ? 'bg-neutral-950/50 border-neutral-800 text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}>
                <tr>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">Threat Type</th>
                  <th className="py-3 px-4 font-semibold">Event Summary</th>
                  <th className="py-3 px-4 font-semibold">User & Dept</th>
                  <th className="py-3 px-4 font-semibold">Client IP</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-neutral-800/60' : 'divide-neutral-100'}`}>
                {logs.map((log) => {
                  const sevStyle = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.INFO
                  const evInfo = EVENT_TYPE_LABELS[log.event_type] || { label: log.event_type, icon: '⚠️' }
                  const isExpanded = expandedId === log.id

                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-neutral-800/40' : 'hover:bg-neutral-50/80'
                      }`}
                    >
                      {/* Severity */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider border ${
                            isDark ? sevStyle.badge : sevStyle.lightBadge
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sevStyle.dot}`} />
                          {log.severity}
                        </span>
                      </td>

                      {/* Threat Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span>{evInfo.icon}</span>
                          <span className={isDark ? 'text-neutral-200' : 'text-neutral-800'}>
                            {evInfo.label}
                          </span>
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="py-3 px-4 max-w-xs md:max-w-md">
                        <p className={`truncate font-mono text-[11px] ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                          {log.summary}
                        </p>
                        {isExpanded && log.details && (
                          <div className={`mt-2 p-2.5 rounded-lg border font-mono text-[10px] space-y-1 ${
                            isDark ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-200 text-neutral-800'
                          }`}>
                            <div><strong>Endpoint:</strong> {log.endpoint}</div>
                            {Object.entries(log.details).map(([k, v]) => (
                              <div key={k}>
                                <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* User & Dept */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className={isDark ? 'text-neutral-300' : 'text-neutral-800'}>
                          {log.user_email || 'Anonymous / Unauth'}
                        </div>
                        {log.department && (
                          <span className={`text-[10px] uppercase font-semibold tracking-wider ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {log.department}
                          </span>
                        )}
                      </td>

                      {/* Client IP */}
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                        {log.client_ip || '—'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {isExpanded ? 'Hide' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

