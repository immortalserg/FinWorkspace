import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import { EventBus, PDFFindController, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import './PdfViewer.css'
import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Official PDF.js PDFViewer: virtualized pages, native text layer, selection
 * and search. Shared by local documents and Paperless-ngx. */
export function PdfViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<PDFViewer | null>(null)
  const findRef = useRef<PDFFindController | null>(null)
  const findEventBusRef = useRef<EventBus | null>(null)
  const [pages, setPages] = useState(0)
  const [current, setCurrent] = useState(1)
  const [zoom, setZoom] = useState('page-width')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    const viewerElement = viewerRef.current
    if (!container || !viewerElement) return
    let disposed = false
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    const findController = new PDFFindController({ eventBus, linkService })
    const viewer = new PDFViewer({
      container,
      viewer: viewerElement,
      eventBus,
      linkService,
      findController,
      textLayerMode: 1,
      removePageBorders: false,
    })
    linkService.setViewer(viewer)
    controllerRef.current = viewer
    findRef.current = findController
    findEventBusRef.current = eventBus
    setLoading(true)
    setError('')
    setPages(0)
    setCurrent(1)
    setQuery('')
    setZoom('page-width')

    const onPagesInit = () => {
      viewer.currentScaleValue = 'page-width'
    }
    const onPageChanging = (event: { pageNumber: number }) => {
      if (!disposed) setCurrent(event.pageNumber)
    }
    eventBus.on('pagesinit', onPagesInit)
    eventBus.on('pagechanging', onPageChanging)

    const task = pdfjs.getDocument(src)
    void task.promise.then((pdf) => {
      if (disposed) return
      linkService.setDocument(pdf)
      findController.setDocument(pdf)
      viewer.setDocument(pdf)
      setPages(pdf.numPages)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (disposed) return
      setError(cause instanceof Error ? cause.message : 'Could not load PDF')
      setLoading(false)
    })

    const resizeObserver = new ResizeObserver(() => {
      if (!disposed && viewer.pdfDocument && viewer.currentScaleValue === 'page-width') {
        viewer.currentScaleValue = 'page-width'
      }
    })
    resizeObserver.observe(container)

    // Keep two-finger zoom inside the PDF instead of zooming the entire PWA.
    // Use PDF.js scaling (not CSS transforms), so the selectable OCR layer
    // remains aligned with the rendered document.
    let pinch: { distance: number; scale: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null = null
    const distance = (touches: TouchList) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    )
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !viewer.pdfDocument) return
      const rect = container.getBoundingClientRect()
      pinch = {
        distance: distance(event.touches),
        scale: viewer.currentScale,
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      }
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinch) return
      event.preventDefault()
      const next = Math.max(0.5, Math.min(4, pinch.scale * distance(event.touches) / pinch.distance))
      if (!Number.isFinite(next)) return
      viewer.currentScale = next
      const ratio = next / pinch.scale
      container.scrollLeft = (pinch.scrollLeft + pinch.x) * ratio - pinch.x
      container.scrollTop = (pinch.scrollTop + pinch.y) * ratio - pinch.y
      setZoom(Math.round(next * 100) + '%')
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null
    }
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('touchcancel', onTouchEnd)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
      eventBus.off('pagesinit', onPagesInit)
      eventBus.off('pagechanging', onPageChanging)
      controllerRef.current = null
      findRef.current = null
      findEventBusRef.current = null
      // Destroying the loading task releases the document and its worker.
      // PDF.js 5 type definitions do not accept null for setDocument.
      void task.destroy()
    }
  }, [src])

  const changeZoom = (direction: number) => {
    const viewer = controllerRef.current
    if (!viewer || !pages) return
    const next = Math.max(0.5, Math.min(3, viewer.currentScale * (direction > 0 ? 1.25 : 0.8)))
    viewer.currentScale = next
    setZoom(Math.round(next * 100) + '%')
  }

  const search = (value: string) => {
    setQuery(value)
    if (!findRef.current || !pages) return
    // PDF.js 5 find controller listens for find events on its EventBus.
    findEventBusRef.current?.dispatch('find', { source: null, type: '',
      query: value, phraseSearch: true, caseSensitive: false,
      entireWord: false, highlightAll: true, findPrevious: false,
    })
  }

  return (
    <div className="flex h-full min-h-[65vh] w-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background p-2">
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={current <= 1} onClick={() => { if (controllerRef.current) controllerRef.current.currentPageNumber = current - 1 }}><ChevronLeft size={16} /></Button>
        <span className="px-1 text-xs tabular-nums">{current} / {pages || '…'}</span>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={current >= pages} onClick={() => { if (controllerRef.current) controllerRef.current.currentPageNumber = current + 1 }}><ChevronRight size={16} /></Button>
        <Button size="icon-sm" variant="outline" aria-label="Zoom out" disabled={!pages} onClick={() => changeZoom(-1)}><Minus size={16} /></Button>
        <Button size="sm" variant="outline" disabled={!pages} onClick={() => { if (controllerRef.current) controllerRef.current.currentScaleValue = 'page-width'; setZoom('page-width') }}>{zoom === 'page-width' ? 'Fit width' : zoom}</Button>
        <Button size="icon-sm" variant="outline" aria-label="Zoom in" disabled={!pages} onClick={() => changeZoom(1)}><Plus size={16} /></Button>
        <label className="flex min-w-24 flex-1 items-center gap-1 rounded-md border px-2"><Search size={16} /><input className="w-full min-w-0 bg-transparent py-1.5 text-sm outline-none" aria-label="Find in document" placeholder="Search PDF" value={query} onChange={(event) => search(event.target.value)} /></label>
      </div>
      {loading && <p role="status" className="p-3 text-center text-sm">Loading PDF…</p>}
      {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
      <div className="relative min-h-[65vh] flex-1 bg-muted/40">
        <div ref={containerRef} className="pdfjs-scroll-container absolute inset-0 overflow-auto" style={{ position: 'absolute' }}>
          <div ref={viewerRef} className="pdfViewer" />
        </div>
      </div>
    </div>
  )
}
