import { useState, useRef } from 'react'
import api from '../services/api'

export function useQuery() {
  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)
  const pendingTokensRef = useRef([])
  const rafIdRef = useRef(null)

  function appendMessage(msg) {
    setMessages((prev) => [...prev, msg])
  }

  function updateLastAssistant(patchOrFn) {
    setMessages((prev) => {
      const next = [...prev]
      const idx = next.findLastIndex((m) => m.role === 'assistant')
      if (idx !== -1) {
        const patch = typeof patchOrFn === 'function' ? patchOrFn(next[idx]) : patchOrFn
        next[idx] = { ...next[idx], ...patch }
      }
      return next
    })
  }

  async function sendQuery(query, stream = true) {
    appendMessage({ role: 'user', content: query })
    setThinking(true)

    if (!stream) {
      try {
        const res = await api.post('/query', { query, stream: false })
        appendMessage({
          role: 'assistant',
          content: res.data.answer,
          sources: res.data.sources ?? [],
          suggestedQuestions: res.data.suggested_questions ?? [],
        })
      } catch (err) {
        if (err.response?.status === 401) {
          window.location.href = '/login'
          return
        }
        const msg = err.response?.data?.detail ?? 'An error occurred while processing your request.'
        appendMessage({ role: 'assistant', content: msg, sources: [] })
      } finally {
        setThinking(false)
      }
      return
    }

    appendMessage({ role: 'assistant', content: '', sources: [], streaming: true })

    try {
      const res = await fetch('/api/v1/query', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, stream: true }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        let errDetail = 'Request failed'
        try {
          const err = await res.json()
          errDetail = err.detail ?? errDetail
        } catch (_) {}
        updateLastAssistant({ content: errDetail, streaming: false })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.token !== undefined) {
              setThinking(false)
              pendingTokensRef.current.push(payload.token)
              if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                  rafIdRef.current = null
                  const batch = pendingTokensRef.current.splice(0).join('')
                  if (batch) updateLastAssistant((prev) => ({ content: (prev.content ?? '') + batch }))
                })
              }
            }
            if (payload.error) {
              setThinking(false)
            }
            if (payload.done) {
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
              }
              const remaining = pendingTokensRef.current.splice(0).join('')
              if (remaining) updateLastAssistant((prev) => ({ content: (prev.content ?? '') + remaining }))
              updateLastAssistant({
                sources: payload.sources ?? [],
                suggestedQuestions: payload.suggested_questions ?? [],
                streaming: false,
              })
            }
          } catch (_) {
            // Ignore malformed individual SSE line
          }
        }
      }
    } catch (err) {
      updateLastAssistant((prev) => ({
        content: prev.content || 'A connection error occurred. Please try again.',
        streaming: false,
      }))
    } finally {
      setThinking(false)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      updateLastAssistant({ streaming: false })
    }
  }

  return { messages, thinking, sendQuery }
}
