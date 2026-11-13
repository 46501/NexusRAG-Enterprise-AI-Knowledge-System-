import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getDocumentFileBlob } from '../services/documents'

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function PdfViewer({
  docIdOrName,
  filename,
  isDark = true,
  onFallbackToChunks,
}) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [renderMode, setRenderMode] = useState('all') // 'all' (scrollable multi-page) | 'single'

  const pdfDocRef = useRef(null)
  const canvasRefs = useRef({})
  const renderTasksRef = useRef({})
  const containerRef = useRef(null)

  // 1. Fetch PDF Blob and load document with pdfjs
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)
    setNumPages(0)
    setCurrentPage(1)
    pdfDocRef.current = null

    async function loadPdf() {
      try {
        const blob = await getDocumentFileBlob(docIdOrName)
        if (isCancelled) return

        if (!blob || blob.size === 0) {
          throw new Error('Received empty PDF binary data from server.')
        }

        // Verify blob is a valid PDF
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)

        const arrayBuffer = await blob.arrayBuffer()
        if (isCancelled) return

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
          cMapPacked: true,
        })

        const pdf = await loadingTask.promise
        if (isCancelled) return

        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
        setLoading(false)
      } catch (err) {
        if (!isCancelled) {
          console.error('[PdfViewer] Failed to load PDF:', err)
          setError(
            err.response?.data?.detail ||
            err.message ||
            'Failed to retrieve or parse the PDF document.'
          )
          setLoading(false)
        }
      }
    }

    if (docIdOrName) {
      loadPdf()
    }

    return () => {
      isCancelled = true
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      // Cancel active render tasks
      Object.values(renderTasksRef.current).forEach((task) => {
        try {
          task?.cancel()
        } catch (_) {}
      })
      renderTasksRef.current = {}
    }
  }, [docIdOrName])

  // 2. Render Page onto Canvas
  const renderPage = useCallback(
    async (pageNumber, canvas) => {
      if (!pdfDocRef.current || !canvas) return

      try {
        // Cancel previous render task for this canvas if in progress
        if (renderTasksRef.current[pageNumber]) {
          try {
            renderTasksRef.current[pageNumber].cancel()
          } catch (_) {}
        }

        const page = await pdfDocRef.current.getPage(pageNumber)
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale })

        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        }

        const renderTask = page.render(renderContext)
        renderTasksRef.current[pageNumber] = renderTask

        await renderTask.promise
        delete renderTasksRef.current[pageNumber]
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`[PdfViewer] Page ${pageNumber} render warning:`, err)
        }
      }
    },
    [scale]
  )

  // 3. Render visible pages when scale or doc changes
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return

    setRendering(true)
    const pagesToRender = renderMode === 'single'
      ? [currentPage]
      : Array.from({ length: numPages }, (_, i) => i + 1)

    Promise.all(
      pagesToRender.map((p) => {
        const canvas = canvasRefs.current[p]
        if (canvas) {
          return renderPage(p, canvas)
        }
        return Promise.resolve()
      })
    ).finally(() => {
      setRendering(false)
    })
  }, [numPages, currentPage, scale, renderMode, renderPage])

  // Zoom helpers
  const handleZoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.2).toFixed(1)))
  const handleZoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)))
  const handleResetZoom = () => setScale(1.2)
  const handleFitWidth = () => {
    if (containerRef.current && pdfDocRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48
      pdfDocRef.current.getPage(1).then((page) => {
        const viewport = page.getViewport({ scale: 1 })
        const newScale = Math.max(0.6, Math.min(2.5, +(containerWidth / viewport.width).toFixed(2)))
        setScale(newScale)
      }).catch(() => {})
    }
  }

  // Page navigation helpers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const target = currentPage - 1
      setCurrentPage(target)
      if (renderMode === 'all') {
        canvasRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const target = currentPage + 1
      setCurrentPage(target)
      if (renderMode === 'all') {
        canvasRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Handle Download
  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || (typeof docIdOrName === 'string' ? docIdOrName : 'document.pdf')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex flex-col h-full w-full select-none" data-testid="pdf-viewer-root">
      {/* PDF Floating Control Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl mb-3 border text-xs shrink-0 shadow-sm"
        style={{
          background: isDark ? 'rgba(24, 27, 40, 0.90)' : 'rgba(248, 250, 252, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#e2e8f0',
        }}
      >
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="pdf-prev-page"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="px-2 py-1 rounded-md font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          <div className="flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (val >= 1 && val <= numPages) {
                  setCurrentPage(val)
                  if (renderMode === 'all') {
                    canvasRefs.current[val]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }
              }}
              className="w-10 text-center bg-transparent border-none outline-none font-bold"
              style={{ color: isDark ? '#38bdf8' : '#0284c7' }}
            />
            <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}>
              / {numPages || '…'}
            </span>
          </div>

          <button
            type="button"
            data-testid="pdf-next-page"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="px-2 py-1 rounded-md font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
            title="Next Page"
          >
            Next ›
          </button>

          {/* Quick Page Jump Selector */}
          {numPages > 1 && (
            <select
              value={currentPage}
              onChange={(e) => {
                const p = Number(e.target.value)
                setCurrentPage(p)
                if (renderMode === 'all') {
                  canvasRefs.current[p]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
              className="px-2 py-1 rounded-md text-[11px] font-medium border outline-none cursor-pointer"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#334155',
              }}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  Page {p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="pdf-zoom-out"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-md font-bold transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
            title="Zoom Out"
          >
            −
          </button>

          <span
            data-testid="pdf-zoom-label"
            className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 min-w-[50px] text-center"
            style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#334155' }}
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            data-testid="pdf-zoom-in"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-md font-bold transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? '#ffffff' : '#0f172a' }}
            title="Zoom In"
          >
            +
          </button>

          <button
            type="button"
            data-testid="pdf-fit-width"
            onClick={handleFitWidth}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }}
            title="Fit to Container Width"
          >
            Fit Width
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }}
            title="Reset Zoom to 120%"
          >
            Reset
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {blobUrl && (
            <button
              type="button"
              data-testid="pdf-download-btn"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
              style={{
                background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                color: isDark ? '#38bdf8' : '#0369a1',
                border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #bae6fd',
              }}
              title="Download original PDF file"
            >
              <span>⬇</span>
              <span>Download</span>
            </button>
          )}
        </div>
      </div>

      {/* PDF Viewport Container */}
      <div
        ref={containerRef}
        data-testid="pdf-scroll-container"
        className="flex-1 overflow-auto rounded-xl p-4 flex flex-col items-center gap-6 min-h-[350px]"
        style={{
          background: isDark ? 'rgba(10, 12, 18, 0.85)' : '#cbd5e1',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e2e8f0',
        }}
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center my-auto py-12 gap-3" data-testid="pdf-loading">
            <div
              className={`w-9 h-9 rounded-full border-2 border-t-transparent animate-spin ${
                isDark ? 'border-sky-400 border-t-white' : 'border-sky-600 border-t-sky-200'
              }`}
            />
            <p className="text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
              Rendering PDF Document...
            </p>
            <p className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}>
              Loading binary pages, fonts, and vector paths
            </p>
          </div>
        )}

        {/* Error State with fallback to Chunks */}
        {error && (
          <div
            className="flex flex-col items-center justify-center my-auto p-6 max-w-lg rounded-2xl border text-center gap-3"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : '#fecaca',
              color: isDark ? '#fca5a5' : '#991b1b',
            }}
          >
            <div className="text-3xl">⚠️</div>
            <h4 className="font-bold text-sm">Failed to Render PDF</h4>
            <p className="text-xs opacity-85 leading-relaxed font-mono">
              {error}
            </p>
            <div className="flex items-center gap-2 pt-2">
              {onFallbackToChunks && (
                <button
                  type="button"
                  onClick={onFallbackToChunks}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
                  style={{
                    background: isDark ? '#9333ea' : '#7c3aed',
                    color: '#ffffff',
                  }}
                >
                  📑 Switch to Extracted Chunks
                </button>
              )}
              {blobUrl && (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#1e293b',
                  }}
                >
                  Open in New Tab ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* Rendered PDF Pages */}
        {!loading && !error && numPages > 0 && (
          <>
            {renderMode === 'all'
              ? Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    className="flex flex-col items-center gap-1.5 transition-all"
                  >
                    {/* Page Container with shadow and white page canvas */}
                    <div
                      className="relative rounded-sm overflow-hidden transition-shadow"
                      style={{
                        boxShadow: isDark
                          ? '0 10px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)'
                          : '0 8px 24px rgba(15,23,42,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
                        background: '#ffffff',
                      }}
                    >
                      <canvas
                        ref={(el) => (canvasRefs.current[pageNum] = el)}
                        data-testid={`pdf-page-${pageNum}`}
                        className="block max-w-full"
                      />
                    </div>

                    {/* Page Label */}
                    <div
                      className="text-[11px] font-mono font-medium px-2 py-0.5 rounded"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b',
                      }}
                    >
                      Page {pageNum} of {numPages}
                    </div>
                  </div>
                ))
              : (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="relative rounded-sm overflow-hidden"
                      style={{
                        boxShadow: isDark
                          ? '0 10px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)'
                          : '0 8px 24px rgba(15,23,42,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
                        background: '#ffffff',
                      }}
                    >
                      <canvas
                        ref={(el) => (canvasRefs.current[currentPage] = el)}
                        data-testid={`pdf-page-${currentPage}`}
                        className="block max-w-full"
                      />
                    </div>
                    <div
                      className="text-[11px] font-mono font-medium"
                      style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#64748b' }}
                    >
                      Page {currentPage} of {numPages}
                    </div>
                  </div>
                )}
          </>
        )}
      </div>
    </div>
  )
}

