import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

const FEEDBACK_REASONS = [
  { id: 'Inaccurate', label: 'Inaccurate / Incorrect', icon: '❌', desc: 'Facts, policy numbers, or calculations are wrong' },
  { id: 'Incomplete', label: 'Incomplete / Missing Context', icon: '📉', desc: 'Missed essential details or sections' },
  { id: 'Missing Citation', label: 'Missing Citation', icon: '🏷️', desc: 'Did not link to the relevant policy document' },
  { id: 'Outdated', label: 'Outdated Policy', icon: '⏳', desc: 'Cites superseded handbook or guidance' },
  { id: 'Off-Topic', label: 'Off-Topic / Hallucinated', icon: '🔀', desc: 'Unrelated to the question asked' },
  { id: 'Other', label: 'Other Feedback', icon: '💬', desc: 'General observation or suggestion' },
]

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const { isDark } = useTheme()
  const [selectedReason, setSelectedReason] = useState('Inaccurate')
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSelectedReason('Inaccurate')
      setComment('')
      setErrorMsg('')
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedReason) {
      setErrorMsg('Please select a reason.')
      return
    }
    setErrorMsg('')
    try {
      await onSubmit({ reason: selectedReason, comment: comment.trim() })
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to submit feedback. Please try again.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative"
        style={{
          background: isDark ? '#111827' : '#ffffff',
          color: isDark ? '#f3f4f6' : '#111827',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
          animation: 'scaleIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                color: isDark ? '#f87171' : '#dc2626',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
              }}
            >
              👎
            </div>
            <div>
              <h2 id="feedback-modal-title" className="text-base font-semibold">
                Provide Answer Feedback
              </h2>
              <p className="text-xs opacity-60">
                Flag inaccuracies to help improve enterprise retrieval and citations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs opacity-60 hover:opacity-100 p-1.5 rounded-lg transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            className="mb-4 p-2.5 rounded-xl text-xs flex items-center gap-2"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              color: isDark ? '#fca5a5' : '#b91c1c',
              border: '1px solid #f87171',
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
              Reason for negative rating
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEEDBACK_REASONS.map((r) => {
                const isSelected = selectedReason === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer"
                    style={{
                      background: isSelected
                        ? isDark
                          ? 'rgba(239, 68, 68, 0.15)'
                          : '#fef2f2'
                        : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : '#f9fafb',
                      border: isSelected
                        ? isDark
                          ? '1px solid #f87171'
                          : '1px solid #ef4444'
                        : isDark
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid #e5e7eb',
                      color: isSelected
                        ? isDark
                          ? '#fca5a5'
                          : '#b91c1c'
                        : 'inherit',
                    }}
                  >
                    <span className="text-sm mt-0.5">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.label}</div>
                      <div className="text-[10px] opacity-60 line-clamp-1">{r.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="feedback-comment" className="text-xs font-semibold uppercase tracking-wider opacity-70">
                Additional details (optional)
              </label>
              <span className="text-[10px] opacity-50">{comment.length}/500</span>
            </div>
            <textarea
              id="feedback-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. The parental leave policy was updated in Q1 2026 to 16 weeks, but the answer stated 12 weeks..."
              className="w-full text-xs p-3 rounded-xl outline-none resize-none transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                color: 'inherit',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all opacity-70 hover:opacity-100 cursor-pointer"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                background: '#dc2626',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Flag</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  )
}
