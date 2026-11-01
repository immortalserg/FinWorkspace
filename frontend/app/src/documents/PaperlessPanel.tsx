import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiFetch, getApiBaseUrl } from '../lib/apiClient'

type Connection = { configured: boolean; url: string | null }
type PaperlessDoc = { id: number; title: string; created?: string }
type DocumentList = { count: number; results: PaperlessDoc[]; next?: string | null }

export function PaperlessPanel() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [documents, setDocuments] = useState<PaperlessDoc[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const status = await apiFetch<Connection>('/paperless/connection')
    setConnection(status)
    if (status.configured) {
      const query = new URLSearchParams({ page: String(page), page_size: '25' })
      if (search.trim()) query.set('search', search.trim())
      const result = await apiFetch<DocumentList>(`/paperless/documents?${query}`)
      setTotal(result.count ?? 0)
      setDocuments(result.results ?? [])
    } else {
      setDocuments([])
    }
  }

  useEffect(() => {
    void refresh().catch(() => toast.error('Could not load Paperless connection'))
  }, [page, search])

  async function save() {
    setBusy(true)
    try {
      await apiFetch('/paperless/connection', {
        method: 'PUT',
        body: JSON.stringify({ url, token }),
      })
      setToken('')
      await refresh()
      toast.success('Paperless connection saved')
    } catch {
      toast.error('Could not save Paperless connection')
    } finally {
      setBusy(false)
    }
  }

  async function upload() {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('metadata', JSON.stringify({ title: file.name }))
      const auth = window.localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/paperless/upload`, {
        method: 'POST',
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
        body: form,
      })
      if (!response.ok) throw new Error(String(response.status))
      setFile(null)
      toast.success('Document submitted for OCR processing')
      await refresh()
    } catch {
      toast.error('Paperless upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function download(id: number) {
    try {
      const auth = window.localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/paperless/documents/${id}/download`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      })
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `paperless-${id}`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      toast.error('Download failed')
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Permanently delete this document from Paperless?')) return
    try {
      await apiFetch(`/paperless/documents/${id}`, { method: 'DELETE' })
      await refresh()
      toast.success('Document deleted')
    } catch {
      toast.error('Could not delete document')
    }
  }

  const filtered = documents

  return (
    <div className="space-y-5 rounded-xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">Paperless-ngx</h2>
        <p className="text-sm text-muted-foreground">Documents remain stored in Paperless-ngx. Connection credentials are stored on the FinWorkspace server.</p>
      </div>
      {connection === null ? (
        <p>Loading connection…</p>
      ) : !connection.configured ? (
        <div className="flex max-w-lg flex-col gap-3">
          <label className="text-sm">Paperless server URL
            <input className="mt-1 w-full rounded border bg-background p-2" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://paperless.example.com" />
          </label>
          <label className="text-sm">API token
            <input type="password" autoComplete="off" className="mt-1 w-full rounded border bg-background p-2" value={token} onChange={(event) => setToken(event.target.value)} />
          </label>
          <Button disabled={busy || !url || !token} onClick={() => void save()}>Connect Paperless</Button>
          <p className="text-xs text-muted-foreground">The administrator must first add this origin to PAPERLESS_ALLOWED_ORIGINS.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Connected: {connection.url}</span>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>Refresh</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void apiFetch('/paperless/connection', { method: 'DELETE' }).then(refresh).catch(() => toast.error('Disconnect failed'))}>Disconnect</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Choose document" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <Button disabled={busy || !file} onClick={() => void upload()}>Upload to Paperless</Button>
          </div>
          <input aria-label="Search Paperless documents" className="w-full max-w-sm rounded border bg-background p-2" placeholder="Search Paperless documents…" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} />
          <div className="divide-y rounded-lg border">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-sm">{doc.title}</span>
                <Button size="sm" variant="outline" onClick={() => void download(doc.id)}>Download</Button>
                <Button size="sm" variant="destructive" onClick={() => void remove(doc.id)}>Delete</Button>
              </div>
            ))}
            {!filtered.length && <p className="p-4 text-sm text-muted-foreground">No documents on this page.</p>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span>Page {page} · {total} documents</span>
            <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  )
}
