import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  generateMarkdownReport,
  formatSessionForSlack,
  downloadFile,
  copyToClipboard,
} from '../utils/exportUtils'

export default function ExportModal({ isOpen, onClose, messages = [], user, department }) {
  const { isDark } = useTheme()
  const [copiedSlack, setCopiedSlack] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [activeTab, setActiveTab] = useState('options') // 'options' | 'preview'

  if (!isOpen) return null

  const markdownContent = generateMarkdownReport(messages, user, department)
  const slackContent = formatSessionForSlack(messages, user, department)

  function handleDownloadMarkdown() {
    const deptStr = department || 'enterprise'
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `NexusRAG_${deptStr}_report_${dateStr}.md`
    downloadFile(filename, markdownContent)
  }

  async function handleCopyMarkdown() {
    const success = await copyToClipboard(markdownContent)
    if (success) {
      setCopiedMd(true)
      setTimeout(() => setCopiedMd(false), 2000)
    }
  }

  async function handleCopySlack() {
    const success = await copyToClipboard(slackContent)
    if (success) {
      setCopiedSlack(true)
      setTimeout(() => setCopiedSlack(false), 2000)
    }
  }

  function handlePrintPdf() {
    onClose()
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all border"
        style={{
          background: isDark ? '#111318' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
          color: isDark ? '#f8fafc' : '#0f172a',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
              style={{
                background: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                color: '#6366f1',
                border: isDark ? '1px solid rgba(99,102,241,0.3)' : '1px solid #c7d2fe',
              }}
            >
              🏛️
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Corporate Export & Share</h3>
              <p className="text-xs opacity-60">Verified knowledge documentation for teams & compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className="flex border-b text-xs font-medium px-6 gap-6"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`py-3 relative cursor-pointer transition-colors ${
              activeTab === 'options' ? 'text-indigo-500 font-semibold' : 'opacity-60 hover:opacity-100'
            }`}
          >
            Export Options
            {activeTab === 'options' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-3 relative cursor-pointer transition-colors ${
              activeTab === 'preview' ? 'text-indigo-500 font-semibold' : 'opacity-60 hover:opacity-100'
            }`}
          >
            Report Preview
            {activeTab === 'preview' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1 doc-scroll">
          {activeTab === 'options' ? (
            <>
              {/* Option 1: PDF Print */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-all hover:border-indigo-500/40"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">🖨️</div>
                  <div>
                    <h4 className="font-semibold text-sm">Print or Save as PDF</h4>
                    <p className="text-xs opacity-60 mt-0.5 leading-relaxed">
                      Executive layout with company header, confidentiality notice, and grounding citation footnotes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm text-white"
                  style={{ background: '#4f46e5' }}
                >
                  Print / PDF
                </button>
              </div>

              {/* Option 2: Markdown File Download */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-all hover:border-indigo-500/40"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">📄</div>
                  <div>
                    <h4 className="font-semibold text-sm">Download Markdown Report (.md)</h4>
                    <p className="text-xs opacity-60 mt-0.5 leading-relaxed">
                      Structured markdown file with metadata tables, ready for Confluence, Notion, or internal wikis.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                    }}
                  >
                    {copiedMd ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer shadow-sm text-white"
                    style={{ background: '#0284c7' }}
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Option 3: Copy for Slack / Teams */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-all hover:border-indigo-500/40"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">💬</div>
                  <div>
                    <h4 className="font-semibold text-sm">Copy for Slack & Teams</h4>
                    <p className="text-xs opacity-60 mt-0.5 leading-relaxed">
                      Formatted with Slack markdown for instant pasting into internal corporate channels.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopySlack}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm text-white"
                  style={{ background: '#059669' }}
                >
                  {copiedSlack ? '✓ Copied!' : 'Copy to Slack'}
                </button>
              </div>

              <div className="pt-2 text-[11px] opacity-50 flex items-center gap-1.5 justify-center">
                <span>🔒</span>
                <span>All exports are processed locally in your browser (0 MB server RAM overhead).</span>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">Markdown Preview</span>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="text-xs font-medium text-indigo-500 hover:underline cursor-pointer"
                >
                  {copiedMd ? '✓ Copied' : 'Copy markdown'}
                </button>
              </div>
              <pre
                className="p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 border"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.3)' : '#f1f5f9',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#334155',
                }}
              >
                {markdownContent}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex justify-end px-6 py-3.5 border-t gap-3"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

