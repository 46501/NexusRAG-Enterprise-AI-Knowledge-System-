/**
 * NexusRAG - Corporate Chat Threads & Session History Persistence Service
 *
 * Provides department-isolated, user-scoped persistence for conversational threads.
 * 0 MB server RAM overhead - runs completely client-side in localStorage with
 * instant search, date grouping, message snippet matching, and thread lifecycle management.
 */

const MAX_THREADS_PER_USER = 60

export function getStorageKey(userId, department) {
  const uid = userId || 'default_user'
  const dept = department || 'general'
  return `nexusrag_threads_${uid}_${dept}`
}

export function getActiveThreadKey(userId, department) {
  const uid = userId || 'default_user'
  const dept = department || 'general'
  return `nexusrag_active_thread_id_${uid}_${dept}`
}

/**
 * Retrieve all saved threads for the given user and department, sorted newest first.
 */
export function getThreads(userId, department) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId, department))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  } catch (err) {
    console.error('Failed to load chat threads from localStorage:', err)
    return []
  }
}

/**
 * Retrieve a specific thread by ID.
 */
export function getThread(userId, department, threadId) {
  if (!threadId) return null
  const threads = getThreads(userId, department)
  return threads.find((t) => t.id === threadId) || null
}

/**
 * Upsert a thread (create new or update existing).
 */
export function saveThread(userId, department, thread) {
  if (!thread || !thread.id) return null
  try {
    const threads = getThreads(userId, department)
    const existingIndex = threads.findIndex((t) => t.id === thread.id)

    const updatedThread = {
      ...thread,
      updatedAt: new Date().toISOString(),
      createdAt: thread.createdAt || new Date().toISOString(),
      department: department || thread.department || 'general',
      userId: userId || thread.userId || 'default_user',
    }

    let nextThreads
    if (existingIndex >= 0) {
      nextThreads = [...threads]
      nextThreads[existingIndex] = updatedThread
    } else {
      nextThreads = [updatedThread, ...threads]
    }

    // Keep within storage ceiling to prevent localStorage overflow
    if (nextThreads.length > MAX_THREADS_PER_USER) {
      nextThreads = nextThreads.slice(0, MAX_THREADS_PER_USER)
    }

    localStorage.setItem(getStorageKey(userId, department), JSON.stringify(nextThreads))
    return updatedThread
  } catch (err) {
    console.error('Failed to save chat thread:', err)
    return thread
  }
}

/**
 * Delete a thread by ID.
 */
export function deleteThread(userId, department, threadId) {
  try {
    const threads = getThreads(userId, department)
    const filtered = threads.filter((t) => t.id !== threadId)
    localStorage.setItem(getStorageKey(userId, department), JSON.stringify(filtered))

    // Clear active thread pointer if it was the deleted one
    const activeId = getActiveThreadId(userId, department)
    if (activeId === threadId) {
      setActiveThreadId(userId, department, null)
    }
    return filtered
  } catch (err) {
    console.error('Failed to delete thread:', err)
    return []
  }
}

/**
 * Delete all saved threads for this user and department.
 */
export function clearAllThreads(userId, department) {
  try {
    localStorage.removeItem(getStorageKey(userId, department))
    setActiveThreadId(userId, department, null)
    return true
  } catch (err) {
    console.error('Failed to clear threads:', err)
    return false
  }
}

/**
 * Get active thread ID for this user/department.
 */
export function getActiveThreadId(userId, department) {
  try {
    return localStorage.getItem(getActiveThreadKey(userId, department)) || null
  } catch (_) {
    return null
  }
}

/**
 * Set active thread ID for this user/department.
 */
export function setActiveThreadId(userId, department, threadId) {
  try {
    if (!threadId) {
      localStorage.removeItem(getActiveThreadKey(userId, department))
    } else {
      localStorage.setItem(getActiveThreadKey(userId, department), threadId)
    }
  } catch (_) {}
}

/**
 * Generate a clean, readable thread title from the initial user prompt.
 */
export function generateThreadTitle(query) {
  if (!query || typeof query !== 'string') return 'New Conversation'

  let cleaned = query.trim()
  // Strip markdown formatting and extra spaces
  cleaned = cleaned.replace(/[*_#`[\]()]/g, ' ').replace(/\s+/g, ' ')

  // Strip conversational prefixes
  const prefixes = [
    /^(can you\s+)?(please\s+)?(tell me\s+about\s+)/i,
    /^(what is\s+(the\s+)?)/i,
    /^(how do I\s+)/i,
    /^(how does\s+(the\s+)?)/i,
    /^(explain\s+(the\s+)?)/i,
    /^(where can I find\s+(the\s+)?)/i,
    /^(give me\s+(the\s+)?)/i,
    /^(summary of\s+(the\s+)?)/i,
  ]

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '')
  }

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)

  // Max 42 characters
  if (cleaned.length > 42) {
    cleaned = cleaned.slice(0, 39).trim() + '…'
  }

  return cleaned || 'New Conversation'
}

/**
 * Full-text search across thread titles and message contents.
 * Returns items decorated with matched snippets.
 */
export function searchThreads(threads, query) {
  if (!query || !query.trim()) return threads

  const q = query.trim().toLowerCase()

  return threads
    .map((thread) => {
      const titleMatches = thread.title && thread.title.toLowerCase().includes(q)
      let snippetMatch = null

      if (Array.isArray(thread.messages)) {
        for (const msg of thread.messages) {
          if (!msg.content) continue
          const content = msg.content
          const lower = content.toLowerCase()
          const idx = lower.indexOf(q)
          if (idx !== -1) {
            const start = Math.max(0, idx - 25)
            const end = Math.min(content.length, idx + q.length + 35)
            const prefix = start > 0 ? '…' : ''
            const suffix = end < content.length ? '…' : ''
            snippetMatch = `${prefix}${content.slice(start, end).trim()}${suffix}`
            break
          }
        }
      }

      if (titleMatches || snippetMatch) {
        return {
          ...thread,
          matchedSnippet: snippetMatch,
          matchedOnTitle: titleMatches,
        }
      }
      return null
    })
    .filter(Boolean)
}

/**
 * Group threads by date categories: Today, Yesterday, Previous 7 Days, Older.
 */
export function groupThreadsByDate(threads) {
  const groups = [
    { key: 'today', title: 'Today', items: [] },
    { key: 'yesterday', title: 'Yesterday', items: [] },
    { key: 'prev7', title: 'Previous 7 Days', items: [] },
    { key: 'older', title: 'Older', items: [] },
  ]

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfPrev7 = startOfToday - 7 * 24 * 60 * 60 * 1000

  for (const thread of threads) {
    const threadTime = new Date(thread.updatedAt || thread.createdAt || 0).getTime()

    if (threadTime >= startOfToday) {
      groups[0].items.push(thread)
    } else if (threadTime >= startOfYesterday) {
      groups[1].items.push(thread)
    } else if (threadTime >= startOfPrev7) {
      groups[2].items.push(thread)
    } else {
      groups[3].items.push(thread)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}

/**
 * Format relative timestamp for thread cards.
 */
export function formatThreadTime(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch (_) {
    return ''
  }
}

export default {
  getThreads,
  getThread,
  saveThread,
  deleteThread,
  clearAllThreads,
  getActiveThreadId,
  setActiveThreadId,
  generateThreadTitle,
  searchThreads,
  groupThreadsByDate,
  formatThreadTime,
}

