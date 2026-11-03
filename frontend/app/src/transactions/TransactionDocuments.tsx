import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch, getApiBaseUrl } from '../lib/apiClient'
import { listDocuments, getPreviewUrl, uploadDocument } from '../documents/documentsApi'

type Link = { id: number; source: 'local' | 'paperless'; document_id: string; title: string }
type Choice = { id: string; title: string; source: 'local' | 'paperless' }

export function TransactionDocuments({ transactionId }: { transactionId: number }) {
  const { t } = useTranslation('transactions')
  const [links, setLinks] = useState<Link[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [source, setSource] = useState<'local' | 'paperless'>('local')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [pendingTask, setPendingTask] = useState<string | null>(null)

  async function refresh() {
    setLinks(await apiFetch<Link[]>(`/transactions/${transactionId}/documents`))
  }

  useEffect(() => {
    void refresh().catch(() => toast.error(t('documents.loadError')))
    setAdding(false)
    setChoices([])
    setSearch('')
  }, [transactionId])

  useEffect(() => {
    if (!adding) return
    let active = true
    const load = async () => {
      if (source === 'local') {
        const docs = await listDocuments({ search })
        if (active) setChoices(docs.map(doc => ({ id: doc.id, title: doc.title, source: 'local' })))
      } else {
        const params = new URLSearchParams({ page_size: '50' })
        if (search.trim()) params.set('search', search.trim())
        const docs = await apiFetch<{ results: Array<{ id: number; title: string }> }>(`/paperless/documents?${params}`)
        if (active) setChoices((docs.results ?? []).map(doc => ({ id: String(doc.id), title: doc.title, source: 'paperless' })))
      }
    }
    void load().catch(() => { if (active) setChoices([]) })
    return () => { active = false }
  }, [adding, source, search])

  async function attach(choice: Choice) {
    setBusy(true)
    try {
      await apiFetch(`/transactions/${transactionId}/documents`, {
        method: 'POST', body: JSON.stringify({ source: choice.source, document_id: choice.id }),
      })
      await refresh()
      setAdding(false)
      toast.success(t('documents.attached'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('documents.attachError'))
    } finally { setBusy(false) }
  }

  async function uploadAndAttach() {
    if (!uploadFile) return
    setBusy(true)
    try {
      const title = uploadTitle.trim() || uploadFile.name
      if (source === 'local') {
        const doc = await uploadDocument(uploadFile, { title })
        await apiFetch(`/transactions/${transactionId}/documents`, {
          method: 'POST', body: JSON.stringify({ source: 'local', document_id: doc.id }),
        })
        await refresh()
        setUploading(false)
        setUploadFile(null)
        setUploadTitle('')
        toast.success(t('documents.uploaded'))
      } else {
        const form = new FormData()
        form.append('file', uploadFile)
        form.append('metadata', JSON.stringify({ title }))
        const result = await apiFetch<{ task_id: string }>('/paperless/upload', { method: 'POST', body: form })
        setPendingTask(String(result.task_id))
        setUploading(false)
        setUploadFile(null)
        setUploadTitle('')
        toast.success(t('documents.sentToPaperless'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('documents.uploadError'))
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!pendingTask) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      try {
        const response = await apiFetch<unknown>('/paperless/tasks')
        const tasks = Array.isArray(response) ? response : (response as { results?: unknown[] })?.results ?? []
        const task = (tasks as Array<Record<string, unknown>>).find(item => String(item.task_id ?? item.id) === pendingTask)
        if (task?.status === 'FAILURE' || task?.status === 'REVOKED') {
          toast.error(t('documents.processingError'))
          setPendingTask(null)
          return
        }
        if (task?.status === 'SUCCESS') {
          const match = String(task.result ?? '').match(/(?:document\\s+id\\s+)?(\\d+)\\s*(?:created)?\\s*$/i)
          if (match) {
            const id = match[1]
            await apiFetch(`/transactions/${transactionId}/documents`, {
              method: 'POST', body: JSON.stringify({ source: 'paperless', document_id: id }),
            })
            if (!active) return
            await refresh()
            setPendingTask(null)
            toast.success(t('documents.paperlessAttached'))
            return
          }
        }
      } catch {
        // Paperless may be temporarily unavailable while OCR is processing.
      }
      if (active) timer = setTimeout(() => void check(), 3000)
    }
    void check()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [pendingTask, transactionId])

  async function detach(id: number) {
    setBusy(true)
    try {
      await apiFetch(`/transactions/${transactionId}/documents/${id}`, { method: 'DELETE' })
      await refresh()
    } catch { toast.error(t('documents.unlinkError')) }
    finally { setBusy(false) }
  }

  async function preview(link: Link) {
    if (link.source === 'local') {
      window.open(getPreviewUrl(link.document_id), '_blank', 'noopener,noreferrer')
      return
    }
    try {
      const token = window.localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/paperless/documents/${link.document_id}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Preview unavailable')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const tab = window.open(url, '_blank', 'noopener,noreferrer')
      if (!tab) toast.error(t('documents.popupError'))
      // Keep the blob URL alive while the opened viewer loads.
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error(t('documents.previewError')) }
  }

  return (
    <section className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t('documents.title')}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(value => !value)}>
          {adding ? t('documents.cancel') : `+ ${t('documents.attach')}`}
        </Button>
      </div>
      {links.map(link => (
        <div key={link.id} className="flex items-center justify-between gap-2 text-sm">
          <button type="button" className="min-w-0 truncate text-left underline" onClick={() => void preview(link)}>
            {link.title} {link.source === 'paperless' ? '(Paperless)' : ''}
          </button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void detach(link.id)}>{t('documents.unlink')}</Button>
        </div>
      ))}
      {pendingTask && <p className="text-xs text-muted-foreground">{t('documents.processing')} {t('documents.keepOpen')}</p>}
      {adding && (
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('documents.storage')}</span>
            <div className="inline-flex rounded-md border border-border bg-muted/50 p-1 gap-1" role="group" aria-label={t('documents.storage')}>
              <Button type="button" size="sm" variant={source === 'local' ? 'default' : 'ghost'} aria-pressed={source === 'local'} className={source === 'local' ? 'shadow-sm' : 'text-muted-foreground'} onClick={() => setSource('local')}>FinWorkspace</Button>
              <Button type="button" size="sm" variant={source === 'paperless' ? 'default' : 'ghost'} aria-pressed={source === 'paperless'} className={source === 'paperless' ? 'shadow-sm' : 'text-muted-foreground'} onClick={() => setSource('paperless')}>Paperless</Button>
            </div>
          </div>
          <div className="flex border-b border-border" role="tablist" aria-label={t('documents.method')}>
            <button type="button" role="tab" aria-selected={!uploading} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!uploading ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setUploading(false)}>{t('documents.existing')}</button>
            <button type="button" role="tab" aria-selected={uploading} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${uploading ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setUploading(true)}>{t('documents.uploadNew')}</button>
          </div>
          {uploading ? <div className="space-y-2"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={event => { const file = event.target.files?.[0] ?? null; setUploadFile(file); setUploadTitle(file?.name ?? "") }} /><Input placeholder={t('documents.documentTitle')} value={uploadTitle} onChange={event => setUploadTitle(event.target.value)} /><Button type="button" size="sm" disabled={busy || !uploadFile || Boolean(pendingTask)} onClick={() => void uploadAndAttach()}>{t('documents.uploadAttach')}</Button></div> : <><Input placeholder={t('documents.search')} value={search} onChange={event => setSearch(event.target.value)} />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {choices.map(choice => (
              <Button key={choice.source + choice.id} type="button" variant="ghost" className="w-full justify-start truncate"
                disabled={busy || links.some(link => link.source === choice.source && link.document_id === choice.id)}
                onClick={() => void attach(choice)}>{choice.title}</Button>
            ))}
          </div></>}
        </div>
      )}
    </section>
  )
}
