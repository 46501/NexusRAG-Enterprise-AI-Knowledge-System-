import api from './api'

export async function fetchSecuritySummary() {
  const res = await api.get('/admin/security/summary')
  return res.data
}

export async function fetchSecurityLogs({ eventType = null, severity = null, search = '', limit = 50, offset = 0 } = {}) {
  const params = { limit, offset }
  if (eventType) params.event_type = eventType
  if (severity) params.severity = severity
  if (search && search.trim()) params.search = search.trim()

  const res = await api.get('/admin/security/logs', { params })
  return res.data
}

export async function unlockUserAccount(email) {
  const res = await api.post('/admin/security/unlock-account', { email })
  return res.data
}

export async function revokeAllUserSessions(userId) {
  const res = await api.post('/admin/security/revoke-user-sessions', { user_id: userId })
  return res.data
}

