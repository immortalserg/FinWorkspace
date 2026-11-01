import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Minus, Plus, Search, Type } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Shared PDF preview. Canvas/text layers for the original layout, plus an
 * accessible OCR-text mode for Android WebView/PWA selection and copying. */
export function PdfViewer({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    let active = true
    const task = pdfjs.getDocument(src)
    pdfRef.current = null
    setLoading(true)
    setError('')
    setPages(0)
    setPageNumber(1)
    setText('')
    void task.promise.then((pdf) => {
      if (!active) return
      pdfRef.current = pdf
      setPages(pdf.numPages)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (active) {
        setLoading(false)
        setError(cause instanceof Error ? cause.message : 'Unable to open PDF')
      }
    })
    return () => {
      active = false
      pdfRef.current = null
      void task.destroy()
    }
  }, [src])

  useEffect(() => {
    const pdf = pdfRef.current
    if (!pdf || !pages) return
    let active = true
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        if (!active) return
        setText(content.items.map((item) => 'str' in item ? item.str : '').join(' '))
      } catch {
        if (active) setText('')
      }
    })()
    return () => { active = false }
  }, [pages, pageNumber])

  useEffect(() => {
    const pdf = pdfRef.current
    const host = hostRef.current
    if (!pdf || !host || !pages || textMode) return
    let active = true
    let renderTask: ReturnType<pdfjs.PDFPageProxy['render']> | null = null
    host.replaceChildren()
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (!active) return
        const availableWidth = Math.max(240, host.clientWidth - 24)
        const base = page.getViewport({ scale: 1 })
        const scale = availableWidth / base.width * zoom
        const viewport = page.getViewport({ scale })
        const wrapper = document.createElement('div')
        wrapper.className = 'relative mx-auto bg-white shadow-sm'
        wrapper.style.width = viewport.width + 'px'
        wrapper.style.height = viewport.height + 'px'
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.ceil(viewport.width * ratio)
        canvas.height = Math.ceil(viewport.height * ratio)
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.pointerEvents = 'none'
        wrapper.appendChild(canvas)
        host.appendChild(wrapper)
        renderTask = page.render({
          canvas, canvasContext: ctx, viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        })
        await renderTask.promise
        if (!active) return
        const layer = document.createElement('div')
        layer.className = 'textLayer'
        layer.style.setProperty('--scale-factor', String(scale))
        layer.style.userSelect = 'text'
        layer.style.setProperty('-webkit-user-select', 'text')
        layer.style.setProperty('-webkit-touch-callout', 'default')
        wrapper.appendChild(layer)
        await new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(), container: layer, viewport,
        }).render()
      } catch (cause) {
        if (active && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) {
          setError(cause instanceof Error ? cause.message : 'PDF render failed')
        }
      }
    })()
    return () => {
      active = false
      renderTask?.cancel()
      host.replaceChildren()
    }
  }, [pages, pageNumber, zoom, textMode])

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Select the text below and use Copy')
    }
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 p-2">
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)}><ChevronLeft size={16} /></Button>
        <span className="px-1 text-xs tabular-nums">{pageNumber} / {pages || '…'}</span>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={pageNumber >= pages} onClick={() => setPageNumber((p) => p + 1)}><ChevronRight size={16} /></Button>
        <Button size="icon-sm" variant="outline" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><Minus size={16} /></Button>
        <span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon-sm" variant="outline" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><Plus size={16} /></Button>
        <Button size="sm" variant={textMode ? 'default' : 'outline'} onClick={() => setTextMode((value) => !value)}><Type size={16} /> OCR text</Button>
      </div>
      {loading && <p role="status" className="p-4 text-center text-sm">Loading PDF…</p>}
      {error && <p role="alert" className="p-4 text-sm text-destructive">{error}</p>}
      {textMode ? (
        <div className="space-y-3 p-3">
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2"><Search size={16} /><input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" aria-label="Find in OCR text" placeholder="Find on this page" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <Button variant="outline" size="sm" disabled={!text} onClick={() => void copyText()}><Copy size={16} /> Copy page</Button>
          </div>
          {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
          <div className="select-text whitespace-pre-wrap rounded-md border bg-background p-4 text-base leading-relaxed" style={{ userSelect: 'text', WebkitUserSelect: 'text', touchAction: 'auto' }}>
            {query && !text.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? 'No matches on this page.\n\n' : ''}
            {text || 'No selectable text found on this page.'}
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto p-3"><div ref={hostRef} className="min-w-0" /></div>
      )}
    </div>
  )
}
