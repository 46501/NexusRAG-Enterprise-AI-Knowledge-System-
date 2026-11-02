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

function toBoldHtml(text, isDark) {
  const markers = (text.match(/\*\*/g) || []).length
  const cleaned = markers % 2 !== 0 ? text.replace(/\*\*(?=[^*]*$)/, '') : text
  const strongColor = isDark ? 'rgba(255,255,255,0.95)' : '#020617'
  const citationBg = isDark ? 'rgba(139,92,246,0.20)' : '#ede9fe'
  const citationColor = isDark ? '#c4b5fd' : '#6d28d9'
  const citationBorder = isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe'

  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/gs, `<strong style="font-weight:600;color:${strongColor}">$1</strong>`)
    .replace(/\[(\d+)\]/g, `<button type="button" data-citation="$1" class="citation-chip cursor-pointer" title="Inspect source [$1]" style="display:inline-flex;align-items:center;justify-content:center;padding:2px 7px;margin:0 2px;font-size:11px;font-weight:600;line-height:1.2;border-radius:9999px;background:${citationBg};color:${citationColor};border:1px solid ${citationBorder};box-shadow:0 1px 2px rgba(0,0,0,0.05);vertical-align:middle;transition:all 0.15s ease;">[$1]</button>`)

  return escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export default function MessageBubble({
  role,
  content,
  userRole,
  sources,
  confidenceScore,
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
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
      style={{ maxWidth: 700, width: '100%', animation: 'msgFadeIn 0.2s ease both' }}
    >
      <div
        onClick={handleContentClick}
        className="max-w-[82%] text-sm"
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
          : <span dangerouslySetInnerHTML={{ __html: toBoldHtml(cleanContent, isDark) }} />
        }
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
