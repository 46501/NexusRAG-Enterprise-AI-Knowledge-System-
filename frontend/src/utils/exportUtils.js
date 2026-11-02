/**
 * Utilities for client-side Corporate Export & Sharing (0 MB Server RAM).
 */

const DEPT_NAMES = {
  hr: 'Human Resources',
  engineering: 'Engineering',
  finance: 'Finance',
  admin: 'Executive Administration',
  demo_admin: 'Demo Administration',
}

export function cleanMessageContent(content) {
  if (!content) return ''
  const delimiter = /---FOLLOW_UPS---|Suggested Follow-ups:|Suggested Questions:/i
  return content.split(delimiter)[0].trim()
}

/**
 * Generate a professional Markdown report of the entire session.
 */
export function generateMarkdownReport(messages, user, department) {
  const deptName = DEPT_NAMES[department] || department || 'Enterprise'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  let md = `# NexusRAG Enterprise Knowledge Session Report\n\n`
  md += `| Metadata | Value |\n`
  md += `| :--- | :--- |\n`
  md += `| **Department** | ${deptName} |\n`
  md += `| **Generated Date** | ${dateStr} at ${timeStr} |\n`
  md += `| **User Account** | ${user?.email || 'Authenticated User'} (${user?.role || 'Enterprise'}) |\n`
  md += `| **Classification** | **CONFIDENTIAL // INTERNAL COMPANY USE ONLY** |\n`
  md += `| **Verification** | Verified with Grounded Retrieval & Source Citations |\n\n`
  md += `---\n\n`
  md += `## Executive Conversation Transcript\n\n`

  let turnNumber = 1
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'user') {
      md += `### Query ${turnNumber}\n`
      md += `**Employee:** ${msg.content}\n\n`
    } else if (msg.role === 'assistant') {
      const cleanAnswer = cleanMessageContent(msg.content)
      md += `**NexusRAG Verified Response:**\n\n${cleanAnswer}\n\n`

      if (msg.sources && msg.sources.length > 0) {
        md += `**Cited Grounding Sources:**\n`
        const seenSources = new Set()
        msg.sources.forEach((s) => {
          const key = s.source || 'Unknown Source'
          if (!seenSources.has(key)) {
            seenSources.add(key)
            const score = s.rerank_score ? ` (Relevance: ${Math.round(s.rerank_score)}%)` : ''
            md += `- **[${s.index || 1}]** \`${s.source}\` — Department: *${s.department}*${score}\n`
          }
        })
        md += `\n`
      }
      md += `---\n\n`
      turnNumber++
    }
  }

  md += `## Compliance & Audit Notice\n`
  md += `This document was generated automatically by NexusRAG Enterprise AI. All facts, policies, and parameters cited above reflect documents indexed within the authorized corporate repository as of the generation timestamp. Do not distribute externally without compliance authorization.\n`

  return md
}

/**
 * Format a single Q&A exchange into an executive brief for Slack/Teams/Email.
 */
export function formatSingleMessageBrief(answerContent, userQuery, sources, user, department) {
  const deptName = DEPT_NAMES[department] || department || 'Enterprise'
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const cleanAns = cleanMessageContent(answerContent)

  let text = `📌 *NexusRAG Corporate Knowledge Brief*\n`
  text += `*Department:* ${deptName}  |  *Date:* ${dateStr}\n\n`
  if (userQuery) {
    text += `*Question:* ${userQuery}\n\n`
  }
  text += `*Answer:* ${cleanAns}\n\n`

  if (sources && sources.length > 0) {
    text += `*Verified Sources:*\n`
    const seen = new Set()
    sources.forEach((s) => {
      const name = s.source || 'Document'
      if (!seen.has(name)) {
        seen.add(name)
        text += `• [${s.index || 1}] ${name} (${s.department})\n`
      }
    })
    text += `\n`
  }

  text += `_Confidential — Internal Company Use Only | NexusRAG Enterprise AI_`
  return text
}

/**
 * Format entire session for Slack / Teams markdown.
 */
export function formatSessionForSlack(messages, user, department) {
  const deptName = DEPT_NAMES[department] || department || 'Enterprise'
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  let text = `🏛️ *NexusRAG Knowledge Session Summary — ${deptName}*\n`
  text += `_Generated on ${dateStr} for ${user?.email || 'User'}_\n\n`
  text += `────────────────────────────────────────\n\n`

  let turn = 1
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'user') {
      text += `*Q${turn}:* ${msg.content}\n`
    } else if (msg.role === 'assistant') {
      text += `*A${turn}:* ${cleanMessageContent(msg.content)}\n`
      if (msg.sources && msg.sources.length > 0) {
        const unique = Array.from(new Set(msg.sources.map((s) => s.source))).join(', ')
        text += `_Sources: ${unique}_\n`
      }
      text += `\n`
      turn++
    }
  }

  text += `────────────────────────────────────────\n`
  text += `_Internal Confidential | Verified via NexusRAG AI_`
  return text
}

/**
 * Triggers a browser file download of text content as a file (0 MB backend RAM).
 */
export function downloadFile(filename, content, mimeType = 'text/markdown;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard safely.
 */
export async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (_) {}
  }

  // Fallback for older browsers
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    return false
  }
}

