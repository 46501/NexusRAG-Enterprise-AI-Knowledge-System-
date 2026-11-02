import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

const DEPT_BTN = {
  hr: '#7c3aed',
  engineering: '#0284c7',
  finance: '#059669',
}

export default function Chat({ onSend, disabled, userRole }) {
  const { isDark } = useTheme()
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)
  const btnColor = DEPT_BTN[userRole] ?? '#374151'

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function handleChange(e) {
    setInput(e.target.value)
    resizeTextarea()
  }

  function submit() {
    const q = input.trim()
    if (!q || disabled) return
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSend(q, true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
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
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your department's documents…"
        rows={1}
        disabled={disabled}
        className={`flex-1 resize-none text-sm focus:outline-none disabled:opacity-50 ${
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
