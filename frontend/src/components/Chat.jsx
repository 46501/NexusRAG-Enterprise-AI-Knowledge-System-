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
      className="flex items-end gap-2.5 rounded-[14px] px-3.5 py-2.5 transition-colors"
      style={{
        background: isDark ? '#141414' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1',
        boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your department's documents…"
        rows={1}
        disabled={disabled}
        className={`flex-1 resize-none text-sm focus:outline-none disabled:opacity-50 ${
          isDark ? 'placeholder:text-white/40' : 'placeholder:text-slate-400'
        }`}
        style={{
          lineHeight: '1.5rem',
          background: 'transparent',
          color: isDark ? 'rgba(255,255,255,0.85)' : '#0f172a',
          fontFamily: 'inherit',
          overflowY: 'hidden',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="shrink-0 text-white text-xs font-medium rounded-[10px] px-4 py-1.5 transition-opacity disabled:opacity-30 cursor-pointer"
        style={{ background: btnColor }}
      >
        Send
      </button>
    </form>
  )
}
