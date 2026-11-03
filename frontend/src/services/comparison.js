/**
 * NexusRAG - Multi-Document Comparison Service
 *
 * Provides prompt engineering, query orchestration, table parsing, and
 * CSV/Markdown export for Side-by-Side Multi-Document Comparison Matrices.
 */
import api from './api'

export const COMPARISON_PRESETS = [
  {
    id: 'comprehensive',
    name: 'Comprehensive Matrix',
    icon: '📊',
    description: 'Compares all primary policy scopes, entitlements, workflows, and penalties.',
  },
  {
    id: 'limits',
    name: 'Limits & Allowances',
    icon: '💰',
    description: 'Compares monetary spending caps, per diem rates, stipends, and thresholds.',
  },
  {
    id: 'compliance',
    name: 'Compliance, SLAs & Penalties',
    icon: '⚖️',
    description: 'Compares regulatory mandates, response SLAs, prohibited actions, and escalation.',
  },
  {
    id: 'workflows',
    name: 'Approval Workflows',
    icon: '🔄',
    description: 'Compares step-by-step procedures, reviewers, signing authority, and turnaround.',
  },
  {
    id: 'custom',
    name: 'Custom Analysis',
    icon: '✍️',
    description: 'Write your own targeted comparison question across the selected files.',
  },
]

/**
 * Builds a structured comparison prompt for Gemini RAG retrieval.
 */
export function buildComparisonPrompt(docNames, mode = 'comprehensive', customPrompt = '') {
  const docsList = docNames.map((d) => `'${d}'`).join(' and ')

  if (mode === 'custom' && customPrompt.trim()) {
    return `Please conduct a side-by-side comparative analysis between ${docsList} regarding: ${customPrompt.trim()}.

Structure your output into:
1. ### Executive Summary: High-level overview and key takeaways.
2. ### Comparative Matrix: A clean, structured markdown table with columns:
| Dimension / Criteria | ${docNames.join(' | ')} | Divergence & Key Notes |
3. ### Key Differences & Recommendations: Bulleted summary explaining discrepancies and practical guidance.

Cite your sources with bracketed numbers like [1], [2] referencing specific clauses from the documents.`
  }

  const dimensionInstructions = {
    comprehensive: `all primary operational, policy, procedural, and compliance dimensions:
1. Core Scope & Objectives
2. Key Entitlements, Limits & Allowances
3. Approval Workflows & Authority
4. Critical Rules, Exceptions & Penalties
5. Action Items & Timeline`,
    limits: `financial limits, spending caps, allowances, stipends, and reimbursable thresholds:
1. Eligibility & Applicable Scope
2. Monetary Caps & Limits (Daily / Monthly / Annual)
3. Receipt & Expense Documentation Requirements
4. Required Approval Levels & Exceptions`,
    compliance: `governance, legal compliance, SLA requirements, security, and penalties:
1. Regulatory & Corporate Compliance Mandates
2. Response Times, Escalations & SLAs
3. Prohibited Actions & Non-Compliance Penalties
4. Audit & Verification Procedures`,
    workflows: `operational workflows, step-by-step submission processes, and approval chains:
1. Request & Submission Process
2. Reviewers & Signing Authority Matrix
3. Standard SLA / Turnaround Time
4. Escalation Path for Blockers`,
  }

  const selectedDimensions = dimensionInstructions[mode] || dimensionInstructions.comprehensive

  return `Please perform a detailed, side-by-side comparative analysis between ${docsList} across ${selectedDimensions}.

Structure your output into:
1. ### Executive Summary: High-level overview of similarities and critical differences.
2. ### Comparative Matrix: A clean, structured markdown table with columns:
| Dimension / Criteria | ${docNames.join(' | ')} | Divergence & Key Notes |
Ensure every row provides specific, actionable details for each document.
3. ### Key Differences & Recommendations: Bulleted summary highlighting discrepancies, potential conflicts, and practical guidance.

Cite your sources with bracketed numbers like [1], [2] referencing specific clauses from the documents.`
}

/**
 * Executes the comparison query against the RAG query API.
 */
export async function runComparisonQuery({ query, department, topK = 8 }) {
  const res = await api.post('/query', {
    query,
    stream: false,
    top_k: topK,
    department,
  })
  return res.data
}

/**
 * Parses markdown text to extract structured table data (headers and rows).
 */
export function parseMarkdownTable(text) {
  if (!text) return null
  const lines = text.split('\n')
  const tableLines = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true
      tableLines.push(trimmed)
    } else if (inTable) {
      if (tableLines.length >= 2) break
      inTable = false
      tableLines.length = 0
    }
  }

  if (tableLines.length < 2) return null

  // Line 0 is header
  const headers = tableLines[0]
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())

  // Line 1 is separator |---|---|
  // Lines 2.. are data rows
  const rows = []
  for (let i = 2; i < tableLines.length; i++) {
    const rowCells = tableLines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (rowCells.some((c) => c.length > 0)) {
      rows.push(rowCells)
    }
  }

  return { headers, rows }
}

/**
 * Export table headers and rows directly to a CSV file.
 */
export function exportTableToCsv(headers, rows, filename = 'document_comparison_matrix.csv') {
  if (!headers || !rows || rows.length === 0) return

  const escapeCsv = (val) => `"${(val || '').replace(/"/g, '""').replace(/\[\d+\]/g, '')}"`
  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Clean and copy markdown table to clipboard.
 */
export async function copyMarkdownToClipboard(content) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return true
  }
  return false
}

export default {
  COMPARISON_PRESETS,
  buildComparisonPrompt,
  runComparisonQuery,
  parseMarkdownTable,
  exportTableToCsv,
  copyMarkdownToClipboard,
}

