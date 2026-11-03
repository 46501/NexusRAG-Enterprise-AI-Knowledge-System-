import { useState, useRef, useEffect, useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'
import SpotlightAutocomplete from './SpotlightAutocomplete'
import { getAutocompleteSuggestions, extractRecentQueriesFromThreads } from '../services/autocomplete'

const DEPT_BTN = {
  hr: '#7c3aed',
  engineering: '#0284c7',
  finance: '#059669',
}

export default function Chat({
  onSend,
  disabled,
  userRole,
  focusDoc = null,
  onClearFocus = null,
  documents = [],
  threads = [],
  onFocusDoc = null,
}) {
  const { isDark } = useTheme()
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const baseInputRef = useRef('')
  const btnColor = DEPT_BTN[userRole] ?? '#374151'

  // Extract recent queries from saved threads
  const recentQueries = useMemo(() => extractRecentQueriesFromThreads(threads), [threads])

  // Compute autocomplete suggestions and ghost text
  const { bestMatch, ghostSuffix, allItems } = useMemo(() => {
    if (isDismissed || !input.trim()) {
      return { bestMatch: null, ghostSuffix: '', allItems: [] }
    }
    return getAutocompleteSuggestions({
      input,
      userRole,
      documents,
      recentQueries,
    })
  }, [input, userRole, documents, recentQueries, isDismissed])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allItems])

  const showPopover = !isDismissed && allItems.length > 0 && input.trim().length >= 2

  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null

    if (SpeechRecognition) {
      setSpeechSupported(true)
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
          let interimText = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            interimText += event.results[i][0].transcript
          }
          if (interimText) {
            setInput(baseInputRef.current + interimText)
            resizeTextarea()
          }
        }

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      } catch (err) {
        console.warn('Speech recognition init failed:', err)
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  function toggleListening() {
    if (!speechSupported || !recognitionRef.current) {
      alert('Voice dictation is not supported by your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    } else {
      try {
        baseInputRef.current = input.trim() ? input.trim() + ' ' : ''
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.warn('Failed to start speech recognition', err)
      }
    }
  }

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function handleChange(e) {
    setInput(e.target.value)
    setIsDismissed(false)
    resizeTextarea()
  }

  function applySelection(item, shouldSubmit = true) {
    if (!item) return
    if (item.type === 'document') {
      if (onFocusDoc) {
        onFocusDoc(item.doc)
      }
      if (input.includes('@')) {
        setInput(input.slice(0, input.lastIndexOf('@')).trim())
      } else {
        setInput('')
      }
      setIsDismissed(true)
      return
    }

    const targetQuery = item.label
    setInput(targetQuery)
    setIsDismissed(true)

    if (shouldSubmit) {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setInput('')
      const docParam = focusDoc?.name || (typeof focusDoc === 'string' ? focusDoc : null)
      onSend(targetQuery, true, docParam)
    }
  }

  function submit() {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    }
    const q = input.trim()
    if (!q || disabled) return
    setInput('')
    setIsDismissed(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    const docParam = focusDoc?.name || (typeof focusDoc === 'string' ? focusDoc : null)
    onSend(q, true, docParam)
  }

  function handleKeyDown(e) {
    if (showPopover) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (allItems.length ? (prev + 1) % allItems.length : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (allItems.length ? (prev - 1 + allItems.length) % allItems.length : 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'ArrowRight' && textareaRef.current?.selectionStart === input.length)) {
        if (ghostSuffix && bestMatch) {
          e.preventDefault()
          setInput(bestMatch)
          setIsDismissed(true)
          return
        } else if (allItems[selectedIndex]) {
          e.preventDefault()
          applySelection(allItems[selectedIndex], false)
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (allItems[selectedIndex]) {
          e.preventDefault()
          applySelection(allItems[selectedIndex], true)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsDismissed(true)
        return
      }
    } else {
      // Popover is closed, but ghost text suffix exists
      if (ghostSuffix && bestMatch && (e.key === 'Tab' || (e.key === 'ArrowRight' && textareaRef.current?.selectionStart === input.length))) {
        e.preventDefault()
        setInput(bestMatch)
        setIsDismissed(true)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape' && !input.trim() && focusDoc && onClearFocus) {
      e.preventDefault()
      onClearFocus()
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="flex items-end gap-2.5 rounded-2xl px-4 py-3 transition-all duration-200 relative focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500/35"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(26, 29, 43, 0.85) 0%, rgba(18, 20, 30, 0.92) 100%)'
          : '#ffffff',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
        boxShadow: isDark
          ? '0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
          : '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Focus Document Scope Pill */}
      {focusDoc && (
        <div
          className="absolute -top-7 left-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-md shadow-sm transition-all"
          style={{
            background: isDark ? 'rgba(168, 85, 247, 0.22)' : '#f3e8ff',
            color: isDark ? '#d8b4fe' : '#7e22ce',
            borderColor: isDark ? 'rgba(168, 85, 247, 0.45)' : '#d8b4fe',
          }}
        >
          <span>🎯</span>
          <span>Focusing on:</span>
          <span className="font-mono font-bold truncate max-w-[200px]">{focusDoc.name || focusDoc}</span>
          {onClearFocus && (
            <button
              type="button"
              onClick={onClearFocus}
              className="ml-1 text-[10px] hover:scale-125 transition-transform cursor-pointer opacity-70 hover:opacity-100"
              title="Clear focus (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Listening Indicator Pill */}
      {isListening && (
        <div
          className="absolute -top-8 left-4 flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-md shadow-sm"
          style={{
            background: isDark ? 'rgba(244, 63, 94, 0.20)' : '#ffe4e6',
            color: isDark ? '#fb7185' : '#e11d48',
            borderColor: isDark ? 'rgba(244, 63, 94, 0.4)' : '#fecdd3',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <span>Listening... speak your question</span>
        </div>
      )}

      {/* Spotlight Autocomplete Popover */}
      <SpotlightAutocomplete
        isOpen={showPopover}
        onClose={() => setIsDismissed(true)}
        items={allItems}
        selectedIndex={selectedIndex}
        onSelect={(item) => applySelection(item, true)}
        inputQuery={input}
      />

      {/* Input area with Inline Ghost Text */}
      <div className="relative flex-1 flex items-center min-w-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? "Listening to your voice..."
              : focusDoc
              ? `Ask anything specifically from ${focusDoc.name || focusDoc}…`
              : "Ask anything about your department's documents…"
          }
          rows={1}
          disabled={disabled}
          className={`w-full resize-none text-sm focus:outline-none disabled:opacity-50 relative z-10 ${
            isDark ? 'placeholder:text-white/35' : 'placeholder:text-slate-400'
          }`}
          style={{
            lineHeight: '1.5rem',
            background: 'transparent',
            color: isDark ? 'rgba(255,255,255,0.92)' : '#0f172a',
            fontFamily: 'inherit',
            overflowY: 'hidden',
            paddingTop: '2px',
            paddingBottom: '2px',
          }}
        />

        {/* Inline Ghost Text (appears right after cursor) */}
        {ghostSuffix && !input.includes('\n') && (
          <div
            className="absolute left-0 top-0 w-full pointer-events-none flex items-center text-sm font-normal select-none overflow-hidden z-0"
            style={{
              lineHeight: '1.5rem',
              paddingTop: '2px',
              paddingBottom: '2px',
              fontFamily: 'inherit',
            }}
          >
            {/* Mirror typed text invisibly so suffix starts at the exact cursor position */}
            <span className="opacity-0 whitespace-pre">{input}</span>
            <span
              className="opacity-45 italic tracking-tight truncate"
              style={{ color: isDark ? '#d8b4fe' : '#7c3aed' }}
            >
              {ghostSuffix}
            </span>
            <span
              className="ml-2 shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded border uppercase tracking-wider opacity-60 inline-flex items-center gap-0.5"
              style={{
                background: isDark ? 'rgba(168, 85, 247, 0.20)' : '#f3e8ff',
                color: isDark ? '#d8b4fe' : '#7e22ce',
                borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : '#d8b4fe',
              }}
            >
              Tab ⇥
            </span>
          </div>
        )}
      </div>

      {/* Voice Dictation (Microphone Button) */}
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={isListening ? "Listening... Click to stop speaking" : "Voice Dictation (Speak your query)"}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
          isListening ? 'scale-105 ring-2 ring-rose-500/60' : 'hover:scale-105 active:scale-95'
        }`}
        style={{
          background: isListening
            ? '#ef4444'
            : isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
          color: isListening ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.75)' : '#475569'),
          border: isListening
            ? '1px solid #dc2626'
            : isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
          boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
        }}
      >
        {isListening ? (
          <span className="w-2.5 h-2.5 rounded-xs bg-white animate-pulse" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
        )}
      </button>

      {/* Send Button */}
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        title="Send message (Enter)"
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all duration-150 disabled:opacity-25 hover:scale-105 active:scale-95 cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          background: btnColor,
          boxShadow: `0 2px 8px ${btnColor}40`,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </form>
  )
}
