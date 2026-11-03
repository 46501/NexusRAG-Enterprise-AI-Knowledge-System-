import { useState, useEffect } from 'react'
import SourceCard from './SourceCard'
import FeedbackModal from './FeedbackModal'
import GroundingConfidenceBadge from './GroundingConfidenceBadge'
import { useTheme } from '../context/ThemeContext'
import { copyToClipboard, formatSingleMessageBrief } from '../utils/exportUtils'
import { submitFeedback } from '../services/feedback'

const DEPT_BG = {
  hr: '#7c3aed',
  engineering: '#0284c7',
  finance: '#059669',
}

function toRichMarkdownHtml(text, isDark) {
  if (!text) return ''

  const strongColor = isDark ? 'rgba(255,255,255,0.98)' : '#020617'
  const citationBg = isDark ? 'rgba(139,92,246,0.20)' : '#ede9fe'
  const citationColor = isDark ? '#c4b5fd' : '#6d28d9'
  const citationBorder = isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe'

  // Step 1: Extract and placeholder code blocks
  const codeBlocks = []
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push({ lang: lang.trim(), code: code.trim() })
    return `__CODE_BLOCK_${idx}__`
  })

  // Step 2: Escape HTML in prose
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Step 3: Inline code `code`
  processed = processed.replace(/`([^`\n]+)`/g, (m, code) => {
    const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    const color = isDark ? '#e2e8f0' : '#0f172a'
    const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
    return `<code style="padding:2px 6px;border-radius:6px;font-size:0.85em;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:${bg};color:${color};border:1px solid ${border};word-break:break-word">${code}</code>`
  })

  // Step 4: Markdown Headings (### and ##)
  processed = processed.replace(/^###\s+(.*$)/gm, `<h4 style="font-size:0.95rem;font-weight:700;margin:16px 0 6px 0;color:${strongColor}">$1</h4>`)
  processed = processed.replace(/^##\s+(.*$)/gm, `<h3 style="font-size:1.05rem;font-weight:700;margin:18px 0 8px 0;color:${strongColor}">$1</h3>`)

  // Step 5: Bold text **bold**
  const markers = (processed.match(/\*\*/g) || []).length
  if (markers % 2 !== 0) {
    processed = processed.replace(/\*\*(?=[^*]*$)/, '')
  }
  processed = processed.replace(/\*\*(.*?)\*\*/gs, `<strong style="font-weight:600;color:${strongColor}">$1</strong>`)

  // Step 6: Blockquotes > quote
  processed = processed.replace(/^&gt;\s+(.*$)/gm, `<blockquote style="border-left:3px solid ${citationBorder};padding-left:12px;margin:8px 0;font-style:italic;color:${isDark ? 'rgba(255,255,255,0.7)' : '#475569'}">$1</blockquote>`)

  // Step 7: Citation Chips [1], [2], etc.
  processed = processed.replace(
    /\[(\d+)\]/g,
    `<button type="button" data-citation="$1" class="citation-chip cursor-pointer" title="Inspect source [$1]" style="display:inline-flex;align-items:center;justify-content:center;padding:2px 7px;margin:0 2px;font-size:11px;font-weight:600;line-height:1.2;border-radius:9999px;background:${citationBg};color:${citationColor};border:1px solid ${citationBorder};box-shadow:0 1px 2px rgba(0,0,0,0.05);vertical-align:middle;transition:all 0.15s ease;">[$1]</button>`
  )

  // Step 8: Paragraphs & lists
  const paragraphs = processed.split(/\n\n+/).map((p) => {
    // If it's a code block placeholder, don't wrap in <p>
    if (p.trim().startsWith('__CODE_BLOCK_') && p.trim().endsWith('__')) {
      return p
    }
    // Check if it's an unordered list
    if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
      const items = p
        .split('\n')
        .map((l) => l.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li style="margin-bottom:4px">${item}</li>`)
        .join('')
      return `<ul style="margin:8px 0 12px 18px;list-style-type:disc;line-height:1.6">${items}</ul>`
    }
    // Check if it's an ordered list
    if (/^\d+\.\s+/.test(p.trim())) {
      const items = p
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li style="margin-bottom:4px">${item}</li>`)
        .join('')
      return `<ol style="margin:8px 0 12px 18px;list-style-type:decimal;line-height:1.6">${items}</ol>`
    }
    return `<p style="margin:0 0 14px 0;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`
  }).join('')

  // Step 9: Re-inject code blocks with syntax styled cards
  return paragraphs.replace(/__CODE_BLOCK_(\d+)__/g, (m, idx) => {
    const block = codeBlocks[Number(idx)]
    if (!block) return ''
    const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const bgCard = isDark ? '#0c0d14' : '#f8fafc'
    const bgHeader = isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'
    const borderCol = isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0'
    const textColor = isDark ? '#e2e8f0' : '#1e293b'

    return `
      <div style="margin:12px 0;border-radius:12px;border:1px solid ${borderCol};background:${bgCard};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:${bgHeader};border-bottom:1px solid ${borderCol};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;font-weight:600;letter-spacing:0.05em;color:${isDark ? 'rgba(255,255,255,0.5)' : '#64748b'}">
          <span style="text-transform:uppercase">${block.lang || 'CODE'}</span>
          <button type="button" data-code="${encodeURIComponent(block.code)}" class="copy-code-btn" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;border:1px solid ${borderCol};background:${isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'};color:${textColor};cursor:pointer;font-size:10px;font-weight:500;transition:all 0.15s ease" title="Copy code snippet">
            <span>📋</span><span>Copy</span>
          </button>
        </div>
        <pre style="margin:0;padding:12px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.55;color:${textColor}"><code>${escapedCode}</code></pre>
      </div>
    `
  })
}

export default function MessageBubble({
  role,
  content,
  userRole,
  sources,
  confidenceScore,
  focusDoc,
  streaming,
  suggestedQuestions,
  precedingUserQuery,
  onOpenCitation,
  onSelectSuggestion,
  onOpenReader,
}) {
  const { isDark } = useTheme()
  const isUser = role === 'user'
  const userBg = DEPT_BG[userRole] ?? '#374151'
  const [copied, setCopied] = useState(false)
  const [copiedBrief, setCopiedBrief] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState(null)
  const [negativeReason, setNegativeReason] = useState(null)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Extract follow-up questions from content or props
  let cleanContent = content || ''
  let followUpList = []

  if (!isUser && content) {
    const delimiter = /---FOLLOW_UPS---|Suggested Follow-ups:|Suggested Questions:/i
    if (delimiter.test(content)) {
      const parts = content.split(delimiter)
      cleanContent = parts[0].trim()
      if (parts[1]) {
        followUpList = parts[1]
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.]\s*/, '').trim())
          .filter((l) => l.length > 3)
          .slice(0, 3)
      }
    }
  }

  if (!isUser && (!followUpList || followUpList.length === 0) && suggestedQuestions && suggestedQuestions.length > 0) {
    followUpList = suggestedQuestions.slice(0, 3)
  }

  const unique = !isUser && sources && sources.length > 0
    ? Array.from(
        sources.reduce((map, s) => {
          const key = s.source || 'unknown'
          if (!map.has(key) || (s.rerank_score ?? 0) > (map.get(key).rerank_score ?? 0)) {
            map.set(key, s)
          }
          return map
        }, new Map()).values()
      ).filter((s) => (s.rerank_score ?? 0) >= 5)
    : []

  function handleContentClick(e) {
    const codeBtn = e.target.closest('[data-code]')
    if (codeBtn) {
      const encoded = codeBtn.getAttribute('data-code')
      if (encoded) {
        const decoded = decodeURIComponent(encoded)
        copyToClipboard(decoded).then((ok) => {
          if (ok) {
            const orig = codeBtn.innerHTML
            codeBtn.innerHTML = '<span>✓</span><span>Copied!</span>'
            setTimeout(() => { codeBtn.innerHTML = orig }, 1800)
          }
        })
        return
      }
    }

    const btn = e.target.closest('[data-citation]')
    if (btn && onOpenCitation) {
      const idx = Number(btn.getAttribute('data-citation'))
      if (!isNaN(idx)) {
        onOpenCitation(idx, sources)
      }
    }
  }

  async function handleCopyAnswer() {
    const success = await copyToClipboard(cleanContent)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleCopyBrief() {
    const brief = formatSingleMessageBrief(cleanContent, precedingUserQuery, sources, null, userRole)
    const success = await copyToClipboard(brief)
    if (success) {
      setCopiedBrief(true)
      setTimeout(() => setCopiedBrief(false), 2000)
    }
  }

  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function cleanTextForSpeech(raw) {
    if (!raw) return ''
    return raw
      .replace(/```[\s\S]*?```/g, ' [Code block omitted] ')
      .replace(/\[\d+\]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/---FOLLOW_UPS[\s\S]*$/i, '')
      .replace(/Suggested Follow-ups:[\s\S]*$/i, '')
      .replace(/\n+/g, ' ')
      .trim()
  }

  function handleToggleSpeech() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Audio speech readout is not supported by your browser.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()

    const textToRead = cleanTextForSpeech(cleanContent)
    if (!textToRead) return

    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.rate = 1.02
    utterance.pitch = 1.0

    const voices = window.speechSynthesis.getVoices()
    const naturalVoice = voices.find(
      (v) =>
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Karen'))) ||
        v.lang === 'en-US'
    ) || voices.find((v) => v.lang.startsWith('en'))

    if (naturalVoice) {
      utterance.voice = naturalVoice
    }

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Speech synthesis error:', e)
      }
      setIsSpeaking(false)
    }

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  async function handleThumbsUp() {
    if (feedbackStatus === 'positive' || submittingFeedback) return
    setSubmittingFeedback(true)
    try {
      const sourcesList = unique.map((s) => s.source || s.file_name).filter(Boolean).join(', ')
      await submitFeedback({
        query_text: precedingUserQuery || 'General query',
        answer_text: cleanContent,
        is_positive: true,
        sources_cited: sourcesList || null,
      })
      setFeedbackStatus('positive')
    } catch (err) {
      console.error('Failed to submit positive feedback', err)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  function handleThumbsDownClick() {
    if (submittingFeedback) return
    setIsFeedbackModalOpen(true)
  }

  async function handleNegativeFeedbackSubmit({ reason, comment }) {
    setSubmittingFeedback(true)
    try {
      const sourcesList = unique.map((s) => s.source || s.file_name).filter(Boolean).join(', ')
      await submitFeedback({
        query_text: precedingUserQuery || 'General query',
        answer_text: cleanContent,
        is_positive: false,
        feedback_reason: reason,
        feedback_comment: comment,
        sources_cited: sourcesList || null,
      })
      setFeedbackStatus('negative')
      setNegativeReason(reason)
      setIsFeedbackModalOpen(false)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} group relative`}
      style={{ maxWidth: 700, width: '100%', animation: 'msgFadeIn 0.2s ease both' }}
    >
      <div className={`relative ${isUser ? 'max-w-[82%]' : 'max-w-[88%] w-fit'}`}>
        {/* Floating macOS-Style Action Bar (Top Right of Assistant Bubble) */}
        {!isUser && !streaming && cleanContent && (
          <div
            className="no-print absolute -top-3.5 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-150 z-20 flex items-center gap-0.5 p-1 rounded-xl shadow-lg border backdrop-blur-2xl select-none"
            style={{
              background: isDark ? 'rgba(18, 20, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
              boxShadow: isDark
                ? '0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                : '0 6px 16px rgba(15,23,42,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
            }}
          >
            <button
              type="button"
              onClick={handleCopyAnswer}
              className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer flex items-center gap-1"
              style={{
                color: copied ? '#10b981' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                background: copied ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : 'transparent',
              }}
              title={copied ? 'Copied to clipboard!' : 'Copy response (Markdown)'}
            >
              <span>{copied ? '✓' : '📋'}</span>
              {copied && <span className="text-[10px] font-semibold">Copied</span>}
            </button>

            <button
              type="button"
              onClick={handleCopyBrief}
              className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer flex items-center gap-1"
              style={{
                color: copiedBrief ? '#8b5cf6' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                background: copiedBrief ? (isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe') : 'transparent',
              }}
              title="Copy executive brief with verified sources"
            >
              <span>{copiedBrief ? '✓' : '🏛️'}</span>
              {copiedBrief && <span className="text-[10px] font-semibold">Brief!</span>}
            </button>

            {unique.length > 0 && onOpenReader && (
              <button
                type="button"
                onClick={() => {
                  const first = unique[0]
                  onOpenReader({ docIdOrName: first.source || first.file_name, chunkIndex: first.chunk_index ?? 0 })
                }}
                className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer"
                style={{
                  color: isDark ? '#38bdf8' : '#0284c7',
                }}
                title={`Open primary source (${unique[0].source || 'document'}) in Document Reader`}
              >
                📖
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSpeech}
              className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer"
              style={{
                color: isSpeaking ? '#818cf8' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
              }}
              title={isSpeaking ? 'Stop reading' : 'Listen aloud'}
            >
              <span>{isSpeaking ? '⏹' : '🔊'}</span>
            </button>

            <span className="w-px h-3.5 bg-black/10 dark:bg-white/10 mx-0.5" />

            <button
              type="button"
              onClick={handleThumbsUp}
              disabled={submittingFeedback || feedbackStatus === 'positive'}
              className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer"
              style={{
                color: feedbackStatus === 'positive' ? '#10b981' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                background: feedbackStatus === 'positive' ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : 'transparent',
              }}
              title="Helpful response"
            >
              👍
            </button>

            <button
              type="button"
              onClick={handleThumbsDownClick}
              disabled={submittingFeedback}
              className="p-1.5 rounded-lg text-xs transition-transform hover:scale-105 cursor-pointer"
              style={{
                color: feedbackStatus === 'negative' ? '#ef4444' : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
                background: feedbackStatus === 'negative' ? (isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2') : 'transparent',
              }}
              title="Report inaccurate response"
            >
              👎
            </button>
          </div>
        )}

        <div
          onClick={handleContentClick}
          className="text-sm select-text"
          style={{
            padding: isUser ? '12px 18px' : '15px 20px',
            lineHeight: 1.62,
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            letterSpacing: '-0.005em',
            ...(isUser
              ? {
                  background: userBg,
                  color: '#fff',
                  whiteSpace: 'pre-wrap',
                  boxShadow: `0 4px 14px ${userBg}40`,
                  fontWeight: 450,
                }
              : {
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.03) 100%)'
                    : '#ffffff',
                  color: isDark ? 'rgba(255,255,255,0.92)' : '#0f172a',
                  border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid #e2e8f0',
                  boxShadow: isDark
                    ? '0 6px 20px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 4px 14px -2px rgba(15,23,42,0.05), 0 1px 2px rgba(0,0,0,0.02)',
                })
          }}
        >
          {isUser
            ? content
            : <div dangerouslySetInnerHTML={{ __html: toRichMarkdownHtml(cleanContent, isDark) }} />
          }
        </div>
      </div>

      {/* Grounding Confidence & Sources Bar */}
      {!isUser && !streaming && ((sources && sources.length > 0) || confidenceScore != null) && (
        <div className="flex gap-2 flex-wrap max-w-[85%] items-center mt-1">
          <GroundingConfidenceBadge
            confidenceScore={confidenceScore}
            sources={sources}
            department={userRole}
            onOpenCitation={onOpenCitation}
            onOpenReader={onOpenReader}
          />

          {focusDoc && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
              style={{
                background: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff',
                color: isDark ? '#d8b4fe' : '#7e22ce',
                borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : '#d8b4fe',
              }}
              title={`Answer scoped exclusively to ${focusDoc}`}
            >
              <span>🎯 Scoped to {focusDoc}</span>
            </span>
          )}

          {unique.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40 ml-1">
                Sources:
              </span>
              {unique.map((s) => (
                <SourceCard
                  key={s.chunk_id || s.index}
                  source={s}
                  onClick={() => onOpenCitation && onOpenCitation(s.index, sources)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Action Toolbar (Copy, Share Brief & Feedback) */}
      {!isUser && !streaming && cleanContent && (
        <div className="no-print flex items-center gap-1.5 mt-0.5 max-w-[78%] flex-wrap">
          <button
            type="button"
            onClick={handleCopyAnswer}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all opacity-60 hover:opacity-100 cursor-pointer"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isDark ? 'rgba(255,255,255,0.75)' : '#475569',
            }}
            title="Copy clean answer text"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyBrief}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all opacity-60 hover:opacity-100 cursor-pointer"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isDark ? 'rgba(255,255,255,0.75)' : '#475569',
            }}
            title="Copy executive brief with verified sources for Slack / Teams"
          >
            <span>{copiedBrief ? '✓' : '🏛️'}</span>
            <span>{copiedBrief ? 'Brief Copied!' : 'Share Brief'}</span>
          </button>

          {/* Audio Read Aloud Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer opacity-70 hover:opacity-100"
            style={{
              background: isSpeaking
                ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff'
                : isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isSpeaking
                ? isDark ? '1px solid #818cf8' : '1px solid #6366f1'
                : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isSpeaking
                ? isDark ? '#c7d2fe' : '#4338ca'
                : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
              boxShadow: isSpeaking ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
            }}
            title={isSpeaking ? 'Stop reading aloud' : 'Listen to executive audio briefing'}
          >
            <span>{isSpeaking ? '⏹' : '🔊'}</span>
            <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
          </button>

          <span className="opacity-25 text-xs mx-0.5">|</span>

          {/* Thumbs Up Button */}
          <button
            type="button"
            onClick={handleThumbsUp}
            disabled={submittingFeedback || feedbackStatus === 'positive'}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
            style={{
              background: feedbackStatus === 'positive'
                ? isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5'
                : isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: feedbackStatus === 'positive'
                ? isDark ? '1px solid #10b981' : '1px solid #34d399'
                : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: feedbackStatus === 'positive'
                ? isDark ? '#6ee7b7' : '#065f46'
                : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
              opacity: feedbackStatus === 'negative' ? 0.4 : 1,
            }}
            title={feedbackStatus === 'positive' ? 'Rated helpful' : 'Mark as helpful'}
          >
            <span>👍</span>
            {feedbackStatus === 'positive' && <span className="font-semibold">Helpful</span>}
          </button>

          {/* Thumbs Down Button */}
          <button
            type="button"
            onClick={handleThumbsDownClick}
            disabled={submittingFeedback}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
            style={{
              background: feedbackStatus === 'negative'
                ? isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'
                : isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: feedbackStatus === 'negative'
                ? isDark ? '1px solid #ef4444' : '1px solid #f87171'
                : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: feedbackStatus === 'negative'
                ? isDark ? '#fca5a5' : '#991b1b'
                : isDark ? 'rgba(255,255,255,0.75)' : '#475569',
              opacity: feedbackStatus === 'positive' ? 0.4 : 1,
            }}
            title={feedbackStatus === 'negative' ? `Flagged: ${negativeReason || 'Issue'}` : 'Report inaccurate or incomplete answer'}
          >
            <span>👎</span>
            {feedbackStatus === 'negative' && (
              <span className="font-semibold truncate max-w-[120px]">
                {negativeReason ? `Flagged (${negativeReason})` : 'Flagged'}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Negative Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleNegativeFeedbackSubmit}
        isSubmitting={submittingFeedback}
      />

      {/* Clickable Suggested Follow-up Pills */}
      {!isUser && !streaming && followUpList.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 max-w-[78%]">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase opacity-50">
            <span>✨</span>
            <span>Suggested follow-ups</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {followUpList.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSuggestion && onSelectSuggestion(q)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                style={{
                  background: isDark ? 'rgba(139,92,246,0.12)' : '#f5f3ff',
                  color: isDark ? '#c4b5fd' : '#6d28d9',
                  border: isDark ? '1px solid rgba(139,92,246,0.25)' : '1px solid #ddd6fe',
                  fontFamily: 'inherit',
                }}
                title={`Ask: "${q}"`}
              >
                <span className="opacity-70 text-[11px]">↳</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes msgFadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        .msg-body p:last-child { margin-bottom: 0 !important; }
        .citation-chip:hover { transform: scale(1.08); filter: brightness(1.1); }
      `}</style>
    </div>
  )
}
