import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiFetch, getApiBaseUrl } from '../lib/apiClient'
import { PaperlessEditDialog } from './PaperlessEditDialog'

type Connection = { configured: boolean; url: string | null }
type PaperlessDoc = { id: number; title: string; created?: string }
type DocumentList = { count: number; results: PaperlessDoc[]; next?: string | null }

export function PaperlessPanel({ openUpload, onUploadOpenChange }: { openUpload: boolean; onUploadOpenChange: (open: boolean) => void }) {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [documents, setDocuments] = useState<PaperlessDoc[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadTags, setUploadTags] = useState<number[]>([])
  const [uploadType, setUploadType] = useState<number | null>(null)
  const [uploadCorrespondent, setUploadCorrespondent] = useState<number | null>(null)
  const [uploadPath, setUploadPath] = useState<number | null>(null)
  const [newReferenceNames, setNewReferenceNames] = useState<Record<string, string>>({})
  const [references, setReferences] = useState<Record<string, { id: number; name: string }[]>>({})
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [ocrTasks, setOcrTasks] = useState<unknown>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function refresh() {
    const status = await apiFetch<Connection>('/paperless/connection')
    setConnection(status)
    if (status.configured) {
      const query = new URLSearchParams({ page: String(page), page_size: '25' })
      if (search.trim()) query.set('search', search.trim())
      const result = await apiFetch<DocumentList>(`/paperless/documents?${query}`)
      setTotal(result.count ?? 0)
      setDocuments(result.results ?? [])
      const keys = ['tags', 'document_types', 'correspondents', 'storage_paths']
      const lists = await Promise.all(keys.map((key) => apiFetch<{ results: { id: number; name: string }[] }>(`/paperless/${key}?page_size=100`)))
      setReferences(Object.fromEntries(keys.map((key, index) => [key, lists[index].results ?? []])))
    } else {
      setDocuments([])
    }
  }

  useEffect(() => {
    void refresh().catch(() => toast.error('Could not load Paperless connection'))
  }, [page, search])

  async function createReference(resource: string) {
    const name = (newReferenceNames[resource] ?? '').trim()
    if (!name) return
    setBusy(true)
    try {
      const created = await apiFetch<{ id: number; name: string }>(`/paperless/${resource}`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setReferences((current) => ({
        ...current,
        [resource]: [...(current[resource] ?? []), created],
      }))
      if (resource === 'tags') setUploadTags((current) => [...current, created.id])
      if (resource === 'document_types') setUploadType(created.id)
      if (resource === 'correspondents') setUploadCorrespondent(created.id)
      if (resource === 'storage_paths') setUploadPath(created.id)
      setNewReferenceNames((current) => ({ ...current, [resource]: '' }))
      toast.success('Created ' + name)
    } catch {
      toast.error('Could not create reference')
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
      form.append('metadata', JSON.stringify({
        title: uploadTitle.trim() || file.name,
        tags: uploadTags,
        ...(uploadType !== null ? { document_type: uploadType } : {}),
        ...(uploadCorrespondent !== null ? { correspondent: uploadCorrespondent } : {}),
        ...(uploadPath !== null ? { storage_path: uploadPath } : {}),
      }))
      const auth = window.localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/paperless/upload`, {
        method: 'POST',
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
        body: form,
      })
      if (!response.ok) throw new Error(String(response.status))
      setFile(null)
      onUploadOpenChange(false)
      setUploadTitle('')
      setUploadTags([])
      setUploadType(null)
      setUploadCorrespondent(null)
      setUploadPath(null)
      toast.success('Document submitted for OCR processing')
      await refresh()
    } catch {
      toast.error('Paperless upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function preview(id: number) {
    try {
      const auth = window.localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/paperless/documents/${id}/preview`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      })
      if (!response.ok) throw new Error(String(response.status))
      const url = URL.createObjectURL(await response.blob())
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return url
      })
      setPreviewId(id)
    } catch {
      toast.error('Archived PDF preview unavailable')
    }
  }

  async function loadTasks() {
    try {
      const result = await apiFetch<unknown>('/paperless/tasks')
      setOcrTasks(result)
    } catch {
      toast.error('Could not load OCR tasks')
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
        <p className="text-sm text-muted-foreground">Paperless-ngx is not configured. An administrator can connect it in Administration → Application settings.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Connected: {connection.url}</span>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>Refresh</Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onUploadOpenChange(true)}>Upload document</Button>
          </div>
          {openUpload && <div role="dialog" aria-modal="true" aria-label="Upload document" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Upload document</h3>
              <Button variant="outline" onClick={() => onUploadOpenChange(false)}>Close</Button>
            </div>
            <input aria-label="Choose document" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <input aria-label="Document title" placeholder="Document title (optional)" className="w-full rounded border bg-background p-2 text-sm" value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['document_types', 'Document type', uploadType, setUploadType],
                ['correspondents', 'Correspondent', uploadCorrespondent, setUploadCorrespondent],
                ['storage_paths', 'Storage path', uploadPath, setUploadPath],
              ] as const).map(([key, label, value, setter]) => (
                <label key={key} className="text-sm">{label}
                  <select className="mt-1 w-full rounded border bg-background p-2" value={value ?? ''} onChange={(event) => setter(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">Automatic / none</option>
                    {(references[key] ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['document_types', 'New document type'],
                ['correspondents', 'New correspondent'],
                ['storage_paths', 'New storage path'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex gap-1">
                  <input aria-label={label} placeholder={label} className="min-w-0 flex-1 rounded border bg-background p-2 text-xs" value={newReferenceNames[key] ?? ''} onChange={(event) => setNewReferenceNames((current) => ({ ...current, [key]: event.target.value }))} />
                  <Button variant="outline" size="sm" disabled={busy || !newReferenceNames[key]?.trim()} onClick={() => void createReference(key)}>Add</Button>
                </div>
              ))}
            </div>
            <fieldset>
              <legend className="text-sm">Tags</legend>
              <div className="flex max-h-28 flex-wrap gap-3 overflow-y-auto">
                {(references.tags ?? []).map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={uploadTags.includes(tag.id)} onChange={(event) => setUploadTags((current) => event.target.checked ? [...current, tag.id] : current.filter((id) => id !== tag.id))} />
                    {tag.name}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input aria-label="New upload tag" placeholder="Create a tag" className="min-w-0 flex-1 rounded border bg-background p-2 text-sm" value={newReferenceNames.tags ?? ''} onChange={(event) => setNewReferenceNames((current) => ({ ...current, tags: event.target.value }))} />
                <Button variant="outline" size="sm" disabled={busy || !newReferenceNames.tags?.trim()} onClick={() => void createReference('tags')}>Add tag</Button>
              </div>
            </fieldset>
            <Button disabled={busy || !file} onClick={() => void upload()}>Upload to Paperless</Button>
            </div>
          </div>}
          <input aria-label="Search Paperless documents" className="w-full max-w-sm rounded border bg-background p-2" placeholder="Search Paperless documents…" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} />
          <div className="divide-y rounded-lg border">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-sm">{doc.title}</span>
                <Button size="sm" variant="outline" onClick={() => void preview(doc.id)}>Preview</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(doc.id)}>Edit</Button>
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
      {connection?.configured && (
        <div className="space-y-2">
          <Button size="sm" variant="outline" onClick={() => void loadTasks()}>Check OCR tasks</Button>
          {ocrTasks !== null && <pre className="max-h-48 overflow-auto rounded border p-3 text-xs">{JSON.stringify(ocrTasks, null, 2)}</pre>}
        </div>
      )}
      {previewUrl && (
        <div role="dialog" aria-modal="true" aria-label={`Preview Paperless document ${previewId}`} className="fixed inset-0 z-50 flex flex-col bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">PDF preview · Document {previewId}</span>
            <Button type="button" variant="outline" aria-label="Закрыть документ" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewId(null) }}><X className="mr-2 h-4 w-4" />Закрыть</Button>
          </div>
          <iframe title="Paperless PDF preview" src={previewUrl} className="min-h-0 w-full flex-1 rounded border" />
        </div>
      )}
      {editingId !== null && <PaperlessEditDialog documentId={editingId} onClose={() => setEditingId(null)} onSaved={() => void refresh()} />}
    </div>
  )
}
