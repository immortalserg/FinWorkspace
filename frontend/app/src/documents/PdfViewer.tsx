import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Renders PDF pages on canvases, including browsers without a native PDF viewer. */
export function PdfViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const canvases: HTMLCanvasElement[] = []
    const loadingTask = pdfjs.getDocument(src)
    setStatus('loading')
    setMessage('')

    void (async () => {
      try {
        const pdf = await loadingTask.promise
        if (cancelled) return
        const host = containerRef.current
        if (!host) return
        host.replaceChildren()
        setStatus('ready')
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) break
          const page = await pdf.getPage(pageNumber)
          if (cancelled) break
          const unscaled = page.getViewport({ scale: 1 })
          const scale = Math.min(2, Math.max(0.5, (host.clientWidth - 16) / unscaled.width))
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas unavailable')
          const ratio = Math.min(window.devicePixelRatio || 1, 2)
          canvas.width = Math.ceil(viewport.width * ratio)
          canvas.height = Math.ceil(viewport.height * ratio)
          canvas.style.width = '100%'
          canvas.style.maxWidth = viewport.width + 'px'
          canvas.style.height = 'auto'
          canvas.className = 'mx-auto mb-3 block bg-white shadow-sm'
          host.appendChild(canvas)
          canvases.push(canvas)
          const render = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
          await render.promise
          page.cleanup()
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Unknown PDF error')
          setStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
      void loadingTask.destroy()
      for (const canvas of canvases) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }, [src])

  return (
    <div className="w-full min-w-0">
      {status === 'loading' && <p role="status" className="p-4 text-center text-sm text-muted-foreground">Loading PDF…</p>}
      {status === 'error' && <p role="alert" className="p-4 text-sm text-destructive">PDF preview unavailable: {message}</p>}
      <div ref={containerRef} className="w-full min-w-0 px-2 py-3" />
    </div>
  )
}
