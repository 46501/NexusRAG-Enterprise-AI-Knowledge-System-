import api from './api'

/**
 * Fetch available agent personas and capabilities.
 */
export async function fetchAgentsList() {
  const res = await api.get('/agents')
  return res.data.agents
}

/**
 * Run Policy Compliance Auditor agent.
 */
export async function runComplianceAudit({ scenario, department, focusDoc }) {
  const res = await api.post('/agents/audit', {
    scenario,
    persona: 'auditor',
    department: department || undefined,
    focus_doc: focusDoc || undefined,
  })
  return res.data
}

/**
 * Run Legal & Operational Risk Assessor agent.
 */
export async function runRiskAssessment({ scenario, department, focusDoc }) {
  const res = await api.post('/agents/risk', {
    scenario,
    persona: 'risk',
    department: department || undefined,
    focus_doc: focusDoc || undefined,
  })
  return res.data
}

/**
 * Run Policy Intelligence Assistant agent.
 */
export async function runPolicyIntelligence({ scenario, department, focusDoc }) {
  const res = await api.post('/agents/intelligence', {
    scenario,
    persona: 'intelligence',
    department: department || undefined,
    focus_doc: focusDoc || undefined,
  })
  return res.data
}

/**
 * Run Multi-Agent Executive Council collaboration.
 */
export async function runAgentCollaboration({ scenario, department, focusDoc }) {
  const res = await api.post('/agents/collaborate', {
    scenario,
    persona: 'collaborative',
    department: department || undefined,
    focus_doc: focusDoc || undefined,
  })
  return res.data
}

/**
 * Unified agent runner.
 */
export async function runAgentWorkflow({ scenario, persona, department, focusDoc }) {
  const res = await api.post('/agents/run', {
    scenario,
    persona,
    department: department || undefined,
    focus_doc: focusDoc || undefined,
  })
  return res.data
}

