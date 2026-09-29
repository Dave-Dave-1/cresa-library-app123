import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import mammoth from 'mammoth'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import type { Resource } from '../types'
import { Icon } from '../components/ui'
import { apiUrl } from '../config'
import {
  getStoredAnnotations,
  saveAnnotation,
  updateAnnotationNote,
  deleteAnnotation,
  type Annotation,
  type HighlightColor,
} from '../data/annotations'
import { AudiobookBar } from '../components/AudiobookBar'
import { TextSelectionToolbar } from '../components/TextSelectionToolbar'
import { AnnotationsDrawer } from '../components/AnnotationsDrawer'
import { PomodoroWidget } from '../components/PomodoroWidget'
import { FlashcardQuizModal } from '../components/FlashcardQuizModal'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type ReaderProps = {
  resource: Resource
  onExit: () => void
  setToast: (message: string) => void
  initialPage: number
  aiEnabled: boolean
  onOpenAI: () => void
  onProgress: (page: number, total: number, completed?: boolean, readingSeconds?: number) => void
}

type ReaderTheme = 'dark' | 'sepia' | 'light'
type FitMode = 'fit-width' | 'fit-page' | 'free'

async function loadBookIntoMemory(urls: string[], signal: AbortSignal) {
  let lastError: unknown = new Error('The local book file returned no data.')

  for (const url of urls) {
    try {
      const response = await fetch(url, { signal, cache: 'no-store' })
      if (!response.ok) throw new Error(`File request failed: ${response.status}`)
      const bytes = await response.arrayBuffer()
      if (!bytes.byteLength) throw new Error('The local book file returned no data.')
      return { bytes, url }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
      lastError = reason
      console.warn('[Cresa Reader] Book source returned no usable data', { url, reason })
    }
  }

  throw lastError
}

function base64Bytes(encoded: string) {
  const binary = window.atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function loadPdfChunks(url: string, signal: AbortSignal) {
  let offset = 0
  let target: Uint8Array | null = null
  while (true) {
    const response = await fetch(`${url}?offset=${offset}&length=786432`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Reader data request failed: ${response.status}`)
    const payload = await response.json() as { ok?: boolean; data?: string; totalBytes?: number; offset?: number; nextOffset?: number; complete?: boolean }
    if (!payload.ok || !payload.data || !payload.totalBytes || payload.offset !== offset || !payload.nextOffset) throw new Error('The reader data response contained an invalid PDF chunk.')
    if (!target) target = new Uint8Array(payload.totalBytes)
    const chunk = base64Bytes(payload.data)
    target.set(chunk, offset)
    offset = payload.nextOffset
    if (payload.complete) break
  }
  if (!target || offset !== target.byteLength) throw new Error('The PDF file could not be reconstructed completely.')
  return new Blob([target.buffer as ArrayBuffer], { type: 'application/pdf' })
}

async function loadPdfBlob(url: string, signal: AbortSignal) {
  if (url.includes('/api/reader-chunks/')) return loadPdfChunks(url, signal)
  const { bytes } = await loadBookIntoMemory([url], signal)
  return new Blob([bytes], { type: 'application/pdf' })
}

export function ReaderPage({ resource, onExit, setToast, initialPage, aiEnabled, onOpenAI, onProgress }: ReaderProps) {
  const [docxHtml, setDocxHtml] = useState('')
  const [pdfStreamReady, setPdfStreamReady] = useState(false)
  const [pdfRenderUrl, setPdfRenderUrl] = useState<string | null>(null)
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [currentPdfPage, setCurrentPdfPage] = useState(Math.max(1, initialPage))
  const [pageInputValue, setPageInputValue] = useState(String(Math.max(1, initialPage)))
  const [pdfZoom, setPdfZoom] = useState(1)
  const [fitMode, setFitMode] = useState<FitMode>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'fit-width' : 'fit-page'))
  const [rotation, setRotation] = useState<number>(0)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => (typeof window !== 'undefined' && (localStorage.getItem('cresa-reader-theme') as ReaderTheme)) || 'dark')
  const [companionOpen, setCompanionOpen] = useState(false)
  const [pageJumpOpen, setPageJumpOpen] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [distractionFree, setDistractionFree] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [status, setStatus] = useState('Opening reader...')
  const [error, setError] = useState('')
  const [readerReload, setReaderReload] = useState(0)

  // New Study Accelerator States
  const [audiobookOpen, setAudiobookOpen] = useState(false)
  const [pomodoroOpen, setPomodoroOpen] = useState(false)
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false)
  const [annotationsDrawerOpen, setAnnotationsDrawerOpen] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>(() => getStoredAnnotations(resource.id))
  const [currentPageText, setCurrentPageText] = useState('')
  const [selectionToolbar, setSelectionToolbar] = useState<{ text: string; position: { top: number; left: number } } | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const pdfCanvas = useRef<HTMLCanvasElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const progress = useRef(onProgress)
  const initialPageRef = useRef(initialPage)
  const readingPosition = useRef({ page: Math.max(1, initialPage), total: 0 })

  const isPdf = resource.format.toUpperCase() === 'PDF'
  const isDocx = resource.format.toUpperCase() === 'DOCX'

  const localBookServerUrl = useMemo(() => {
    const filename = resource.downloadUrl.split('/').pop()
    // Keep the API path relative to the current host so it also works when the
    // development server is opened from another device on the local network.
    // Vite proxies this route to the book server in development.
    if (!filename || !resource.downloadUrl.startsWith('/books/')) return null
    return apiUrl(`/api/books/${encodeURIComponent(filename)}`)
  }, [resource.downloadUrl])

  const readerDataUrl = useMemo(() => {
    const filename = resource.downloadUrl.split('/').pop()
    // Do not limit this to localhost. On a LAN address the raw PDF route can
    // be intercepted by browser extensions and appear as an empty response;
    // the chunk endpoint avoids that and remains relative to the current host.
    if (!isPdf || !filename || !resource.downloadUrl.startsWith('/books/')) return null
    const token = btoa(filename).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    return apiUrl(`/api/reader-chunks/${token}`)
  }, [isPdf, resource.downloadUrl])

  const pdfViewerSource = readerDataUrl ?? resource.downloadUrl

  // Reading timer
  useEffect(() => {
    const timer = window.setInterval(() => setSessionSeconds(sec => sec + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const formattedSessionTime = useMemo(() => {
    const mins = Math.floor(sessionSeconds / 60)
    const secs = sessionSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }, [sessionSeconds])

  useEffect(() => {
    progress.current = onProgress
  }, [onProgress])

  useEffect(() => {
    initialPageRef.current = initialPage
  }, [initialPage])

  const handleThemeChange = (nextTheme: ReaderTheme) => {
    setReaderTheme(nextTheme)
    try {
      localStorage.setItem('cresa-reader-theme', nextTheme)
    } catch {
      // storage unavailable
    }
  }

  // File loading
  useEffect(() => {
    let active = true
    setStatus(`Loading ${resource.format} inside Cresa Reader...`)
    setError('')
    setDocxHtml('')
    setPdfStreamReady(false)
    setPdfRenderUrl(null)
    setPdfDocument(null)
    setPdfPageCount(0)
    setCurrentPdfPage(Math.max(1, initialPage))
    setPageInputValue(String(Math.max(1, initialPage)))
    setPdfZoom(1)
    setRotation(0)

    if (isPdf) {
      const controller = new AbortController()
      let renderUrl: string | null = null
      const backendUrl = pdfViewerSource
      void loadPdfBlob(backendUrl, controller.signal)
        .then(blob => {
          renderUrl = URL.createObjectURL(blob)
          if (!active) {
            URL.revokeObjectURL(renderUrl)
            return
          }
          setPdfRenderUrl(renderUrl)
          setPdfStreamReady(true)
          setStatus(`PDF stream ready: ${(blob.size / 1024 / 1024).toFixed(1)} MB`)
        })
        .catch(reason => {
          if (!active || (reason instanceof DOMException && reason.name === 'AbortError')) return
          const message = reason instanceof Error ? reason.message : 'Unknown PDF stream error'
          setError(message)
          setStatus(`Could not open this PDF: ${message}`)
        })
      return () => {
        active = false
        controller.abort()
        if (renderUrl) URL.revokeObjectURL(renderUrl)
      }
    }

    if (!isDocx) {
      setStatus(`In-app preview is not available for ${resource.format}.`)
      return () => { active = false }
    }

    const controller = new AbortController()
    const sources = [...(localBookServerUrl ? [localBookServerUrl] : []), resource.downloadUrl]
    void loadBookIntoMemory(sources, controller.signal)
      .then(async ({ bytes }) => {
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes })
        if (!active) return
        setDocxHtml(result.value)
        if (result.value) {
          const temp = document.createElement('div')
          temp.innerHTML = result.value
          setCurrentPageText(temp.textContent || '')
        }
        setStatus('Word document ready.')
      })
      .catch(reason => {
        if (!active || (reason instanceof DOMException && reason.name === 'AbortError')) return
        const message = reason instanceof Error ? reason.message : 'Unknown DOCX error'
        setError(message)
        setStatus(`Could not open this DOCX file: ${message}`)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [isDocx, isPdf, localBookServerUrl, pdfViewerSource, readerReload, resource.downloadUrl, resource.format])

  // PDF Document Initialization
  useEffect(() => {
    if (!isPdf || !pdfRenderUrl) return
    let disposed = false
    const loadingTask = getDocument({ url: pdfRenderUrl, disableAutoFetch: true, disableStream: true })

    void loadingTask.promise
      .then(document => {
        if (disposed) return
        const page = Math.min(Math.max(1, initialPageRef.current), document.numPages)
        setPdfDocument(document)
        setPdfPageCount(document.numPages)
        setCurrentPdfPage(page)
        setPageInputValue(String(page))
        setStatus(`PDF ready: ${document.numPages} pages.`)
      })
      .catch(reason => {
        if (disposed) return
        const message = reason instanceof Error ? reason.message : 'The PDF viewer could not load this file.'
        setError(message)
        setStatus(`Could not render this PDF: ${message}`)
      })

    return () => {
      disposed = true
      void loadingTask.destroy()
    }
  }, [isPdf, pdfRenderUrl])

  // PDF Page Canvas Rendering
  useEffect(() => {
    if (!isPdf || !pdfDocument || !pdfCanvas.current) return
    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
    const canvas = pdfCanvas.current
    setIsRendering(true)

    void Promise.resolve()
      .then(() => pdfDocument.getPage(currentPdfPage))
      .then(page => {
        if (cancelled) return
        const baseViewport = page.getViewport({ scale: 1, rotation })
        const container = workspaceRef.current
        let computedScale = pdfZoom

        if (container) {
          const isMobile = window.innerWidth < 768
          const paddingX = isMobile ? 16 : 48
          const paddingY = isMobile ? 24 : 48
          const availWidth = Math.max(280, container.clientWidth - paddingX)
          const availHeight = Math.max(340, container.clientHeight - paddingY)

          if (fitMode === 'fit-width') {
            computedScale = (availWidth / baseViewport.width) * pdfZoom
          } else if (fitMode === 'fit-page') {
            const scaleW = availWidth / baseViewport.width
            const scaleH = availHeight / baseViewport.height
            computedScale = Math.min(scaleW, scaleH) * pdfZoom
          }
        }

        const viewport = page.getViewport({ scale: Math.max(0.2, computedScale), rotation })
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5) // Cap for mobile memory optimization

        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const context = canvas.getContext('2d')
        if (!context) throw new Error('The browser could not create a PDF canvas.')
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        })
        return renderTask.promise
      })
      .then(() => {
        if (cancelled) return
        setIsRendering(false)
        readingPosition.current = { page: currentPdfPage, total: pdfPageCount }
        progress.current(currentPdfPage, pdfPageCount, currentPdfPage === pdfPageCount)
        setStatus(`Reading page ${currentPdfPage} of ${pdfPageCount}.`)

        // Extract text for Audiobook, Flashcards, and Quizzes
        void pdfDocument.getPage(currentPdfPage).then(p => p.getTextContent()).then(tc => {
          if (cancelled) return
          const extracted = tc.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' ')
          setCurrentPageText(extracted)
        }).catch(() => {})
      })
      .catch(reason => {
        if (cancelled || (reason instanceof Error && reason.name === 'RenderingCancelledException')) return
        setIsRendering(false)
        const message = reason instanceof Error ? reason.message : 'The PDF page could not be rendered.'
        setError(message)
        setStatus(`Could not render this PDF: ${message}`)
      })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [currentPdfPage, fitMode, isPdf, pdfDocument, pdfPageCount, pdfZoom, rotation])

  const changePdfPage = useCallback((nextPage: number) => {
    if (!pdfPageCount) return
    const page = Math.min(Math.max(1, nextPage), pdfPageCount)
    setCurrentPdfPage(page)
    setPageInputValue(String(page))
    setSelectionToolbar(null)
  }, [pdfPageCount])

  // In-Book Text Selection & Quick Annotation Handlers
  const handleSelectionCheck = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      setSelectionToolbar(null)
      return
    }
    const text = sel.toString().trim()
    if (text.length < 2) {
      setSelectionToolbar(null)
      return
    }
    try {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSelectionToolbar({
          text,
          position: {
            top: rect.top + window.scrollY,
            left: Math.max(10, rect.left + rect.width / 2),
          },
        })
      }
    } catch {
      // range issue
    }
  }

  const handleHighlight = (color: HighlightColor) => {
    if (!selectionToolbar) return
    const created = saveAnnotation({
      resourceId: resource.id,
      page: currentPdfPage,
      text: selectionToolbar.text,
      color,
    })
    setAnnotations(prev => [created, ...prev])
    setToast('Highlight saved to notes')
    setSelectionToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleAddNote = () => {
    if (!selectionToolbar) return
    const created = saveAnnotation({
      resourceId: resource.id,
      page: currentPdfPage,
      text: selectionToolbar.text,
      color: 'yellow',
      note: '',
    })
    setAnnotations(prev => [created, ...prev])
    setSelectionToolbar(null)
    setAnnotationsDrawerOpen(true)
    window.getSelection()?.removeAllRanges()
  }

  const handleExplainWithAI = (text: string) => {
    setSelectionToolbar(null)
    window.getSelection()?.removeAllRanges()
    onOpenAI()
  }

  // Periodic reading time recorder
  useEffect(() => {
    let savedAt = Date.now()
    const saveReadingTime = () => {
      const now = Date.now()
      const position = readingPosition.current
      progress.current(position.page, position.total, false, Math.max(1, Math.round((now - savedAt) / 1000)))
      savedAt = now
    }
    const timer = window.setInterval(saveReadingTime, 15_000)
    return () => {
      window.clearInterval(timer)
      saveReadingTime()
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        changePdfPage(currentPdfPage + 1)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        changePdfPage(currentPdfPage - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        changePdfPage(1)
      } else if (event.key === 'End') {
        event.preventDefault()
        changePdfPage(pdfPageCount)
      } else if (event.key.toLowerCase() === 'f') {
        void toggleFullscreen()
      } else if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        setRotation(r => (r + 90) % 360)
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-') {
        event.preventDefault()
        zoomOut()
      } else if (event.key === '0') {
        event.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changePdfPage, currentPdfPage, pdfPageCount])

  // Mobile Touch Gestures (Swipe to change page)
  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: Date.now(),
    }
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touchEnd = event.changedTouches[0]
    const deltaX = touchEnd.clientX - touchStartRef.current.x
    const deltaY = touchEnd.clientY - touchStartRef.current.y
    const deltaTime = Date.now() - touchStartRef.current.time

    touchStartRef.current = null

    // Check if it's a horizontal swipe
    if (deltaTime < 500 && Math.abs(deltaX) > 55 && Math.abs(deltaY) < 65) {
      if (deltaX < 0) {
        changePdfPage(currentPdfPage + 1)
      } else {
        changePdfPage(currentPdfPage - 1)
      }
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await root.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }

  const zoomIn = () => {
    setFitMode('free')
    setPdfZoom(z => Number(Math.min(2.5, z + 0.15).toFixed(2)))
  }

  const zoomOut = () => {
    setFitMode('free')
    setPdfZoom(z => Number(Math.max(0.4, z - 0.15).toFixed(2)))
  }

  const resetZoom = () => {
    setFitMode('fit-page')
    setPdfZoom(1)
  }

  const toggleFitMode = () => {
    setFitMode(curr => (curr === 'fit-width' ? 'fit-page' : 'fit-width'))
    setPdfZoom(1)
  }

  const reloadReader = () => {
    setReaderReload(value => value + 1)
    setToast('Reloading document...')
  }

  const download = async () => {
    try {
      setToast(`Starting ${resource.format} download...`)
      const sources = [...(localBookServerUrl ? [localBookServerUrl] : []), resource.downloadUrl]
      const { bytes } = await loadBookIntoMemory(sources, new AbortController().signal)
      const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
      const link = document.createElement('a')
      link.href = url
      link.download = resource.downloadUrl.split('/').pop() ?? `${resource.title}.${isPdf ? 'pdf' : 'docx'}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setToast('Download could not be started.')
    }
  }

  const handlePageInputSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const pageNum = parseInt(pageInputValue, 10)
    if (!isNaN(pageNum)) {
      changePdfPage(pageNum)
    } else {
      setPageInputValue(String(currentPdfPage))
    }
    setPageJumpOpen(false)
  }

  const progressPercent = pdfPageCount > 0 ? Math.round((currentPdfPage / pdfPageCount) * 100) : 0

  return (
    <div
      className={`pro-reader-page theme-${readerTheme} ${companionOpen ? 'companion-open' : ''} ${distractionFree ? 'distraction-free' : ''}`}
      ref={root}
    >
      {/* Top Reading Progress Line */}
      <div className="reader-top-progress" style={{ width: `${progressPercent}%` }} />

      {/* Main Reader Header */}
      <header className="pro-reader-header">
        <div className="pro-reader-header-left">
          <button className="reader-back-btn" onClick={onExit} title="Exit Reader (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Close</span>
          </button>

          <div className="reader-header-divider" />

          <div className="reader-doc-meta" title={`${resource.courseCode} · ${resource.title}`}>
            <span className="reader-course-badge">{resource.courseCode}</span>
            <strong className="reader-doc-title">{resource.title}</strong>
            <span className="reader-doc-format">{resource.format} · {resource.fileSize}</span>
          </div>
        </div>

        {/* Center Page Controls (Desktop/Tablet) */}
        {isPdf && pdfStreamReady && !error && (
          <div className="pro-reader-header-center">
            <button
              className="reader-btn reader-icon-btn"
              disabled={currentPdfPage <= 1}
              onClick={() => changePdfPage(1)}
              title="First Page (Home)"
              aria-label="First page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
            </button>

            <button
              className="reader-btn reader-icon-btn"
              disabled={currentPdfPage <= 1}
              onClick={() => changePdfPage(currentPdfPage - 1)}
              title="Previous Page (Left Arrow)"
              aria-label="Previous page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <form onSubmit={handlePageInputSubmit} className="reader-page-jump-form">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="reader-page-input"
                value={pageInputValue}
                onChange={e => setPageInputValue(e.target.value)}
                onBlur={handlePageInputSubmit}
                aria-label="Current page number"
              />
              <span className="reader-page-total">/ {pdfPageCount || '…'}</span>
            </form>

            <button
              className="reader-btn reader-icon-btn"
              disabled={!pdfPageCount || currentPdfPage >= pdfPageCount}
              onClick={() => changePdfPage(currentPdfPage + 1)}
              title="Next Page (Right Arrow)"
              aria-label="Next page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            <button
              className="reader-btn reader-icon-btn"
              disabled={!pdfPageCount || currentPdfPage >= pdfPageCount}
              onClick={() => changePdfPage(pdfPageCount)}
              title="Last Page (End)"
              aria-label="Last page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
              </svg>
            </button>
          </div>
        )}

        {/* Right Tools */}
        <div className="pro-reader-header-right">
          {/* Zoom controls (Desktop) */}
          {isPdf && pdfStreamReady && !error && (
            <div className="reader-zoom-group">
              <button className="reader-btn reader-icon-btn" onClick={zoomOut} title="Zoom Out (-)" aria-label="Zoom out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                </svg>
              </button>

              <button
                className={`reader-btn reader-fit-btn ${fitMode === 'fit-width' ? 'is-active' : ''}`}
                onClick={toggleFitMode}
                title={fitMode === 'fit-width' ? 'Fit Page Height' : 'Fit Page Width'}
              >
                {fitMode === 'fit-width' ? (
                  <span className="fit-indicator">↔ Fit Width</span>
                ) : fitMode === 'fit-page' ? (
                  <span className="fit-indicator">↕ Fit Page</span>
                ) : (
                  <span className="fit-indicator">{Math.round(pdfZoom * 100)}%</span>
                )}
              </button>

              <button className="reader-btn reader-icon-btn" onClick={zoomIn} title="Zoom In (+)" aria-label="Zoom in">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              <button
                className={`reader-btn reader-icon-btn ${rotation > 0 ? 'is-active' : ''}`}
                onClick={() => setRotation(r => (r + 90) % 360)}
                title={`Rotate 90° (R) - Currently ${rotation}°`}
                aria-label="Rotate page 90 degrees"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 7" />
                  <path d="M21 3v4h-4" />
                </svg>
              </button>
            </div>
          )}

          {/* Theme selector */}
          <div className="reader-theme-picker" title="Viewer Background Theme">
            <button
              className={`theme-dot theme-dot-dark ${readerTheme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
              aria-label="Dark mode"
            />
            <button
              className={`theme-dot theme-dot-sepia ${readerTheme === 'sepia' ? 'active' : ''}`}
              onClick={() => handleThemeChange('sepia')}
              aria-label="Sepia mode"
            />
            <button
              className={`theme-dot theme-dot-light ${readerTheme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
              aria-label="Light mode"
            />
          </div>

          {/* Fullscreen */}
          <button
            className="reader-btn reader-icon-btn reader-desktop-only"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (F)"
            aria-label="Toggle fullscreen"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>

          {/* 🎧 Audiobook / Listen Mode button */}
          <button
            className={`reader-btn ${audiobookOpen ? 'is-active' : ''}`}
            onClick={() => setAudiobookOpen(!audiobookOpen)}
            title="Listen Mode / Audiobook (TTS)"
            aria-label="Text to speech audiobook"
          >
            <span style={{ fontSize: 14 }}>🎧</span>
            <span className="reader-desktop-only">Listen</span>
          </button>

          {/* ⏱️ Pomodoro Focus Timer button */}
          <button
            className={`reader-btn ${pomodoroOpen ? 'is-active' : ''}`}
            onClick={() => setPomodoroOpen(!pomodoroOpen)}
            title="Pomodoro Focus Timer & Study Streaks"
            aria-label="Pomodoro focus timer"
          >
            <span style={{ fontSize: 14 }}>⏱️</span>
            <span className="reader-desktop-only">Focus</span>
          </button>

          {/* 📝 Highlights & Notes Drawer button */}
          <button
            className={`reader-btn ${annotationsDrawerOpen ? 'is-active' : ''}`}
            onClick={() => setAnnotationsDrawerOpen(!annotationsDrawerOpen)}
            title="View Highlights & Sticky Notes"
            aria-label="Annotations and notes"
          >
            <span style={{ fontSize: 14 }}>📝</span>
            <span className="reader-desktop-only">Notes</span>
            {annotations.length > 0 && (
              <b style={{ fontSize: 10, padding: '1px 5px', borderRadius: 999, background: 'rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                {annotations.length}
              </b>
            )}
          </button>

          {/* Reading Companion Toggle Button */}
          {aiEnabled && (
            <button
              className={`reader-btn reader-companion-btn ${companionOpen ? 'is-active' : ''}`}
              onClick={() => setCompanionOpen(!companionOpen)}
              title="Toggle AI Reading Companion"
            >
              <span className="companion-sparkle">✦</span>
              <span className="companion-label">AI Companion</span>
              <span className="companion-timer">{formattedSessionTime}</span>
            </button>
          )}

          {/* Download button */}
          <button className="reader-download-btn" onClick={download} title="Download this document">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />
            </svg>
            <span className="download-text">Download</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="pro-reader-body">
        {/* PDF & Document Viewing Canvas */}
        <main
          className="pro-reader-workspace"
          ref={workspaceRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => {
            handleTouchEnd(e)
            handleSelectionCheck()
          }}
          onMouseUp={handleSelectionCheck}
          onClick={(e) => {
            // If user clicked directly on workspace background or canvas on mobile, toggle distraction-free mode
            if (window.innerWidth < 768 && (e.target === workspaceRef.current || (e.target as HTMLElement).tagName === 'CANVAS')) {
              setDistractionFree(df => !df)
            }
          }}
        >
          {/* Loading status banner */}
          {isPdf && !pdfStreamReady && !error && (
            <div className="pro-reader-state">
              <div className="reader-spinner" />
              <h3>Opening Document</h3>
              <p>{status}</p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="pro-reader-state error-state">
              <div className="state-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
              </div>
              <h3>Document Preview Unavailable</h3>
              <p>{status}</p>
              <div className="state-actions">
                <button className="reader-primary-btn" onClick={reloadReader}>Retry</button>
                <button className="reader-secondary-btn" onClick={download}>Download File</button>
              </div>
            </div>
          )}

          {/* Render PDF Canvas */}
          {isPdf && pdfStreamReady && pdfRenderUrl && !error && (
            <div className="pro-pdf-stage">
              {isRendering && (
                <div className="pdf-rendering-pill">
                  <span className="pill-spinner" />
                  Rendering page {currentPdfPage}…
                </div>
              )}
              <canvas
                ref={pdfCanvas}
                className={`pro-pdf-canvas ${rotation ? `rotate-${rotation}` : ''}`}
                aria-label={`Page ${currentPdfPage} of ${resource.title}`}
              />
            </div>
          )}

          {/* DOCX document preview */}
          {isDocx && !docxHtml && !error && (
            <div className="pro-reader-state">
              <div className="reader-spinner" />
              <h3>Formatting Word Document</h3>
              <p>{status}</p>
            </div>
          )}

          {isDocx && docxHtml && !error && (
            <div className="pro-docx-wrapper">
              <article className="pro-docx-article" dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </div>
          )}

          {/* Unsupported format */}
          {!isPdf && !isDocx && (
            <div className="pro-reader-state">
              <h3>Format Not Previewable</h3>
              <p>This document ({resource.format}) can be downloaded directly.</p>
              <button className="reader-primary-btn" onClick={download}>Download Now</button>
            </div>
          )}
        </main>

        {/* AI Reading Companion Sidebar / Bottom-Sheet */}
        {aiEnabled && (
          <aside className={`pro-reader-companion ${companionOpen ? 'is-open' : ''}`} aria-label="Reading Companion">
            <div className="companion-header">
              <div className="companion-title">
                <span className="companion-header-sparkle">✦</span>
                <div>
                  <strong>Reading Companion</strong>
                  <small>Active Document Assistant</small>
                </div>
              </div>
              <button className="companion-close-btn" onClick={() => setCompanionOpen(false)} aria-label="Close companion">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="companion-content">
              {/* Reading Stats Card */}
              <div className="companion-stats-card">
                <div className="stats-row">
                  <span className="stats-label">Time Reading</span>
                  <span className="stats-value">{formattedSessionTime}</span>
                </div>
                <div className="stats-row">
                  <span className="stats-label">Current Progress</span>
                  <span className="stats-value">{progressPercent}%</span>
                </div>
                <div className="companion-progress-track">
                  <div className="companion-progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
                <small className="stats-subtext">Page {currentPdfPage} of {pdfPageCount || '…'} · Tracking saved</small>
              </div>

              {/* Page Quick Scrubber */}
              {isPdf && pdfPageCount > 1 && (
                <div className="companion-scrubber-section">
                  <label htmlFor="companion-page-slider" className="scrubber-label">
                    <span>Seek Page</span>
                    <b>P. {currentPdfPage}</b>
                  </label>
                  <input
                    id="companion-page-slider"
                    type="range"
                    min="1"
                    max={pdfPageCount}
                    value={currentPdfPage}
                    onChange={e => changePdfPage(Number(e.target.value))}
                    className="pro-range-slider"
                  />
                  <div className="scrubber-markers">
                    <button onClick={() => changePdfPage(1)}>Start</button>
                    <button onClick={() => changePdfPage(Math.round(pdfPageCount / 2))}>Middle</button>
                    <button onClick={() => changePdfPage(pdfPageCount)}>End</button>
                  </div>
                </div>
              )}

              {/* Quick AI & Study Prompts */}
              <div className="companion-actions-section">
                <p className="actions-header">Study Accelerators</p>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    setFlashcardModalOpen(true)
                  }}
                >
                  <span className="action-pill-icon">🗂️</span>
                  <div>
                    <strong>Generate Flashcards & Quiz</strong>
                    <small>3D flip cards & practice questions for this section</small>
                  </div>
                </button>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    setAudiobookOpen(true)
                  }}
                >
                  <span className="action-pill-icon">🎧</span>
                  <div>
                    <strong>Audiobook / Listen Mode</strong>
                    <small>Natural text-to-speech audio reader</small>
                  </div>
                </button>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    setPomodoroOpen(true)
                  }}
                >
                  <span className="action-pill-icon">⏱️</span>
                  <div>
                    <strong>Focus Timer & Study Streaks</strong>
                    <small>Pomodoro sessions, streaks & achievement badges</small>
                  </div>
                </button>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    setAnnotationsDrawerOpen(true)
                  }}
                >
                  <span className="action-pill-icon">📝</span>
                  <div>
                    <strong>In-Book Highlights & Notes</strong>
                    <small>Manage quotes, sticky notes & annotations ({annotations.length})</small>
                  </div>
                </button>

                <p className="actions-header" style={{ marginTop: 10 }}>AI Companion Tools</p>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    onOpenAI()
                  }}
                >
                  <span className="action-pill-icon">📄</span>
                  <div>
                    <strong>Summarise Current Page</strong>
                    <small>Get concise takeaways for page {currentPdfPage}</small>
                  </div>
                </button>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    onOpenAI()
                  }}
                >
                  <span className="action-pill-icon">📚</span>
                  <div>
                    <strong>Summarise Entire Document</strong>
                    <small>High-level overview & core thesis</small>
                  </div>
                </button>

                <button
                  className="companion-action-pill"
                  onClick={() => {
                    setCompanionOpen(false)
                    onOpenAI()
                  }}
                >
                  <span className="action-pill-icon">❓</span>
                  <div>
                    <strong>Ask Study Questions</strong>
                    <small>Open interactive inquiry with CresaBot</small>
                  </div>
                </button>
              </div>

              {/* Open full chat button */}
              <button
                className="companion-chat-launch-btn"
                onClick={() => {
                  setCompanionOpen(false)
                  onOpenAI()
                }}
              >
                <span>Ask CresaBot Any Question</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </aside>
        )}

        {/* Mobile Backdrop for Companion Drawer */}
        {companionOpen && (
          <div
            className="companion-mobile-backdrop"
            onClick={() => setCompanionOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Floating Bottom Navigation Dock for Mobile / Ergonomic Reading */}
      {isPdf && pdfStreamReady && !error && (
        <nav className="pro-reader-mobile-dock" aria-label="Reading navigation">
          <button
            className="mobile-dock-btn"
            disabled={currentPdfPage <= 1}
            onClick={() => changePdfPage(currentPdfPage - 1)}
            aria-label="Previous page"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            className="mobile-dock-page-btn"
            onClick={() => setPageJumpOpen(true)}
            aria-label="Jump to page"
          >
            <strong>{currentPdfPage}</strong>
            <span>/ {pdfPageCount || '…'}</span>
          </button>

          <button
            className="mobile-dock-btn"
            disabled={!pdfPageCount || currentPdfPage >= pdfPageCount}
            onClick={() => changePdfPage(currentPdfPage + 1)}
            aria-label="Next page"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div className="mobile-dock-divider" />

          <button
            className={`mobile-dock-btn ${audiobookOpen ? 'is-active' : ''}`}
            onClick={() => setAudiobookOpen(!audiobookOpen)}
            title="Audiobook Player"
            aria-label="Audiobook"
          >
            🎧
          </button>

          <button
            className={`mobile-dock-btn ${annotationsDrawerOpen ? 'is-active' : ''}`}
            onClick={() => setAnnotationsDrawerOpen(!annotationsDrawerOpen)}
            title="Highlights & Notes"
            aria-label="Annotations and notes"
          >
            📝
          </button>

          <button
            className={`mobile-dock-btn ${fitMode === 'fit-width' ? 'is-active' : ''}`}
            onClick={toggleFitMode}
            title="Toggle Fit Width"
            aria-label="Fit width"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8l4 4-4 4M6 8l-4 4 4 4M2 12h20" />
            </svg>
          </button>

          {aiEnabled && (
            <button
              className={`mobile-dock-btn mobile-dock-ai ${companionOpen ? 'is-active' : ''}`}
              onClick={() => setCompanionOpen(!companionOpen)}
              aria-label="Open AI Companion"
            >
              ✦
            </button>
          )}
        </nav>
      )}

      {/* Quick Jump Modal */}
      {pageJumpOpen && (
        <div className="reader-jump-dialog-backdrop" onClick={() => setPageJumpOpen(false)}>
          <div className="reader-jump-dialog" onClick={e => e.stopPropagation()}>
            <div className="jump-dialog-header">
              <h3>Jump to Page</h3>
              <button onClick={() => setPageJumpOpen(false)}>✕</button>
            </div>
            <form onSubmit={handlePageInputSubmit}>
              <div className="jump-input-wrap">
                <input
                  type="number"
                  min="1"
                  max={pdfPageCount}
                  autoFocus
                  value={pageInputValue}
                  onChange={e => setPageInputValue(e.target.value)}
                  className="jump-dialog-input"
                />
                <span>of {pdfPageCount}</span>
              </div>
              <div className="jump-dialog-shortcuts">
                <button type="button" onClick={() => { changePdfPage(1); setPageJumpOpen(false) }}>Page 1</button>
                <button type="button" onClick={() => { changePdfPage(Math.round(pdfPageCount * 0.25)); setPageJumpOpen(false) }}>25%</button>
                <button type="button" onClick={() => { changePdfPage(Math.round(pdfPageCount * 0.5)); setPageJumpOpen(false) }}>50%</button>
                <button type="button" onClick={() => { changePdfPage(Math.round(pdfPageCount * 0.75)); setPageJumpOpen(false) }}>75%</button>
                <button type="button" onClick={() => { changePdfPage(pdfPageCount); setPageJumpOpen(false) }}>Last</button>
              </div>
              <button type="submit" className="reader-primary-btn jump-submit-btn">Go to Page</button>
            </form>
          </div>
        </div>
      )}

      {/* Feature 2: In-Book Text Selection Quick Toolbar */}
      {selectionToolbar && (
        <TextSelectionToolbar
          position={selectionToolbar.position}
          selectedText={selectionToolbar.text}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onAskAI={handleExplainWithAI}
          onClose={() => setSelectionToolbar(null)}
        />
      )}

      {/* Feature 1: Audiobook / Text-to-Speech Floating Player */}
      {audiobookOpen && (
        <AudiobookBar
          text={currentPageText}
          title={resource.title}
          currentPage={currentPdfPage}
          totalPages={pdfPageCount || 1}
          onNextPage={() => changePdfPage(currentPdfPage + 1)}
          onPrevPage={() => changePdfPage(currentPdfPage - 1)}
          onClose={() => setAudiobookOpen(false)}
          setToast={setToast}
        />
      )}

      {/* Feature 2: Highlights & Sticky Notes Drawer */}
      <AnnotationsDrawer
        isOpen={annotationsDrawerOpen}
        annotations={annotations}
        currentPage={currentPdfPage}
        onJumpToPage={p => {
          changePdfPage(p)
          setAnnotationsDrawerOpen(false)
        }}
        onUpdateNote={(id, note) => setAnnotations(updateAnnotationNote(id, note))}
        onDeleteAnnotation={id => setAnnotations(deleteAnnotation(id))}
        onClose={() => setAnnotationsDrawerOpen(false)}
      />

      {/* Feature 3: Pomodoro Focus Timer & Study Streaks Modal */}
      <PomodoroWidget
        isOpen={pomodoroOpen}
        onClose={() => setPomodoroOpen(false)}
        setToast={setToast}
      />

      {/* Feature 4: AI Flashcard & Quiz Generator Modal */}
      <FlashcardQuizModal
        isOpen={flashcardModalOpen}
        onClose={() => setFlashcardModalOpen(false)}
        bookTitle={resource.title}
        currentPage={currentPdfPage}
        pageText={currentPageText}
        courseCode={resource.courseCode}
      />
    </div>
  )
}
