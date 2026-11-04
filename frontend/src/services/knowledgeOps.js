import api from './api'

export async function fetchKnowledgeOpsOverview() {
  const res = await api.get('/admin/knowledge-ops/overview')
  return res.data
}

export async function scanContradictions(department = null) {
  const params = department ? { department } : {}
  const res = await api.post('/admin/knowledge-ops/contradictions/scan', null, { params })
  return res.data
}

export async function fetchFreshnessRanking(department = null) {
  const params = department ? { department } : {}
  const res = await api.get('/admin/knowledge-ops/freshness', { params })
  return res.data
}

export async function generatePolicyDraft({ topic, department, scopeDescription = '', sampleQueries = [] }) {
  const res = await api.post('/admin/knowledge-ops/draft', {
    topic,
    department,
    scope_description: scopeDescription,
    sample_queries: sampleQueries,
  })
  return res.data
}

export async function publishPolicyDraft({ filename, department, content }) {
  const res = await api.post('/admin/knowledge-ops/draft/publish', {
    filename,
    department,
    content,
  })
  return res.data
}

export async function fetchDemandForecast() {
  const res = await api.get('/admin/knowledge-ops/forecast')
  return res.data
}

export async function fetchHealthIndex() {
  const res = await api.get('/admin/knowledge-ops/health-index')
  return res.data
}
