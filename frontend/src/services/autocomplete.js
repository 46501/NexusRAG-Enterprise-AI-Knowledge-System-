/**
 * NexusRAG - Spotlight Autocomplete & Question Typeahead Service
 *
 * Provides department-specific corporate question banks, document mention matching,
 * inline ghost text completion, and ranking.
 */

export const ENTERPRISE_QUESTIONS = {
  hr: [
    'What is the parental leave duration and eligibility criteria?',
    'What is the vacation PTO and sick leave accrual policy?',
    'How does the annual performance review process work?',
    'What health, medical, vision, and dental plans are available?',
    'How do I submit an expense for remote home office equipment?',
    'What are the core working hours and remote work guidelines?',
    'What is the 401(k) retirement plan company matching percentage?',
    'What is the bereavement, compassionate, and jury duty leave policy?',
    'How do I request an internal department transfer or promotion?',
    'What educational assistance and tuition reimbursement is offered?',
    'What is the company code of conduct and anti-harassment policy?',
    'How are employee grievances and HR complaints escalated?',
  ],
  engineering: [
    'What is the production deployment and release pipeline process?',
    'How are production incidents and Sev-1 outages escalated?',
    'What are the REST API design, versioning, and auth standards?',
    'What is the pull request review criteria before merging to main?',
    'Where are architecture decision records (ADRs) documented?',
    'What are the Kubernetes cluster scaling and rollback procedures?',
    'What are the security standards for storing API keys and secrets?',
    'How is database schema migration executed in production?',
    'What is the service-level objective (SLO) and error budget policy?',
    'What are the monitoring, logging, and Datadog alert standards?',
    'How do we handle zero-downtime rolling deployments?',
    'What is the on-call compensation and rotation schedule policy?',
  ],
  finance: [
    'What is the daily meal and travel expense reimbursement limit?',
    'When are quarterly budget reviews and fiscal planning scheduled?',
    'What does the corporate financial audit preparation look like?',
    'What is the purchasing and signing approval threshold by role?',
    'What are the payment terms and vendor invoice approval rules?',
    'What is the corporate credit card policy and receipt submission deadline?',
    'How are capital expenditure (CapEx) requests submitted and approved?',
    'What are the international wire transfer and currency exchange guidelines?',
    'What are the depreciation schedules for corporate hardware assets?',
    'How do department managers reallocate quarterly OPEX budgets?',
    'What is the tax compliance and VAT invoice retention requirement?',
    'What is the mileage reimbursement rate for business travel?',
  ],
}

/**
 * Extract unique user queries from saved past threads.
 */
export function extractRecentQueriesFromThreads(threads) {
  if (!Array.isArray(threads)) return []
  const queries = new Set()

  for (const t of threads) {
    if (Array.isArray(t.messages)) {
      for (const m of t.messages) {
        if (m.role === 'user' && m.content && m.content.trim().length > 4) {
          queries.add(m.content.trim())
        }
      }
    }
  }

  return Array.from(queries)
}

/**
 * Computes autocomplete suggestions and ghost text for the current input.
 */
export function getAutocompleteSuggestions({
  input = '',
  userRole = 'engineering',
  documents = [],
  recentQueries = [],
  maxItems = 8,
}) {
  const rawInput = input.trim()
  if (!rawInput || rawInput.length < 2) {
    return {
      bestMatch: null,
      ghostSuffix: '',
      questions: [],
      documents: [],
      recent: [],
      allItems: [],
    }
  }

  const queryLower = rawInput.toLowerCase()
  const isAtMention = rawInput.includes('@')
  const atQuery = isAtMention ? rawInput.slice(rawInput.lastIndexOf('@') + 1).toLowerCase() : ''

  // 1. Match Documents
  let matchingDocs = []
  if (isAtMention) {
    matchingDocs = documents.filter((d) =>
      d.name.toLowerCase().includes(atQuery)
    )
  } else {
    matchingDocs = documents.filter((d) =>
      d.name.toLowerCase().includes(queryLower)
    )
  }

  const docItems = matchingDocs.slice(0, 3).map((d) => ({
    type: 'document',
    id: `doc_${d.id}`,
    label: d.name,
    subtitle: `${d.chunk_count} chunks · Focus or Ask`,
    doc: d,
  }))

  // 2. Match Department Policy Questions
  const deptQuestions = ENTERPRISE_QUESTIONS[userRole] || ENTERPRISE_QUESTIONS.engineering

  // Score questions: exact prefix match > word boundary match > includes match
  const scoredQuestions = deptQuestions
    .map((q) => {
      const qLower = q.toLowerCase()
      if (qLower.startsWith(queryLower)) {
        return { text: q, score: 3 }
      }
      if (qLower.includes(' ' + queryLower)) {
        return { text: q, score: 2 }
      }
      if (qLower.includes(queryLower)) {
        return { text: q, score: 1 }
      }
      // Check all words match
      const words = queryLower.split(/\s+/).filter(Boolean)
      if (words.length > 1 && words.every((w) => qLower.includes(w))) {
        return { text: q, score: 1 }
      }
      return null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const questionItems = scoredQuestions.slice(0, 5).map((sq) => ({
    type: 'question',
    id: `q_${sq.text}`,
    label: sq.text,
    subtitle: 'Enterprise Knowledge Base',
  }))

  // 3. Match Recent Inquiries from Threads
  const matchingRecent = recentQueries
    .filter((rq) => {
      const rqLower = rq.toLowerCase()
      return rqLower.includes(queryLower) && !deptQuestions.includes(rq)
    })
    .slice(0, 3)
    .map((rq) => ({
      type: 'recent',
      id: `recent_${rq}`,
      label: rq,
      subtitle: 'From your recent threads',
    }))

  // Compute Ghost Suffix (for inline completion)
  let bestMatch = null
  let ghostSuffix = ''

  // Look for a question that starts with the current rawInput (case-insensitive)
  const prefixMatch = deptQuestions.find((q) =>
    q.toLowerCase().startsWith(queryLower)
  )

  if (prefixMatch && prefixMatch.length > rawInput.length) {
    bestMatch = prefixMatch
    // Preserve typed case and append remaining tail
    ghostSuffix = prefixMatch.slice(rawInput.length)
  }

  // Flatten all items for arrow key navigation
  const allItems = [...questionItems, ...docItems, ...matchingRecent].slice(0, maxItems)

  return {
    bestMatch,
    ghostSuffix,
    questions: questionItems,
    documents: docItems,
    recent: matchingRecent,
    allItems,
  }
}

export default {
  ENTERPRISE_QUESTIONS,
  extractRecentQueriesFromThreads,
  getAutocompleteSuggestions,
}

