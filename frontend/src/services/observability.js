import api from './api'

export async function fetchObservabilityOverview() {
  const res = await api.get('/admin/observability/overview')
  return res.data
}

export async function fetchTelemetryDrift() {
  const res = await api.get('/admin/observability/drift')
  return res.data
}

export async function fetchRegressionMatrix() {
  const res = await api.get('/admin/observability/regression')
  return res.data
}

export async function triggerContinuousEval(sampleLimit = null) {
  const res = await api.post('/admin/observability/eval/run', {
    sample_limit: sampleLimit,
  })
  return res.data
}

export async function fetchEvalStatus() {
  const res = await api.get('/admin/observability/eval/status')
  return res.data
}

export async function setEvalScheduleInterval(interval) {
  const res = await api.post('/admin/observability/eval/schedule', { interval })
  return res.data
}
