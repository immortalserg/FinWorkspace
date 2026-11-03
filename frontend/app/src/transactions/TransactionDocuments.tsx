import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch, getApiBaseUrl } from '../lib/apiClient'
import { listDocuments, getPreviewUrl } from '../documents/documentsApi'

type Link = { id: number; source: 'local' | 'paperless'; document_id: string; title: string }
type Choice = { id: string; title: string; source: 'local' | 'paperless' }

export function TransactionDocuments({ transactionId }: { transactionId: number }) {
  const [links, setLinks] = useState<Link[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [source, setSource] = useState<'local' | 'paperless'>('local')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setLinks(await apiFetch<Link[]>(`/transactions/${transactionId}/documents`))
  }

  useEffect(() => {
    void refresh().catch(() => toast.error('Could not load transaction documents'))
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
      toast.success('Документ прикреплён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось прикрепить документ')
    } finally { setBusy(false) }
  }

  async function detach(id: number) {
    setBusy(true)
    try {
      await apiFetch(`/transactions/${transactionId}/documents/${id}`, { method: 'DELETE' })
      await refresh()
    } catch { toast.error('Не удалось удалить связь') }
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
      if (!tab) toast.error('Разрешите всплывающие окна для просмотра')
      // Keep the blob URL alive while the opened viewer loads.
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Не удалось открыть документ') }
  }

  return (
    <section className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Документы</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(value => !value)}>
          {adding ? 'Отмена' : '+ Прикрепить'}
        </Button>
      </div>
      {links.map(link => (
        <div key={link.id} className="flex items-center justify-between gap-2 text-sm">
          <button type="button" className="min-w-0 truncate text-left underline" onClick={() => void preview(link)}>
            {link.title} {link.source === 'paperless' ? '(Paperless)' : ''}
          </button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void detach(link.id)}>Удалить связь</Button>
        </div>
      ))}
      {adding && (
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={source === 'local' ? 'secondary' : 'outline'} onClick={() => setSource('local')}>FinWorkspace</Button>
            <Button type="button" size="sm" variant={source === 'paperless' ? 'secondary' : 'outline'} onClick={() => setSource('paperless')}>Paperless</Button>
          </div>
          <Input placeholder="Поиск документа" value={search} onChange={event => setSearch(event.target.value)} />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {choices.map(choice => (
              <Button key={choice.source + choice.id} type="button" variant="ghost" className="w-full justify-start truncate"
                disabled={busy || links.some(link => link.source === choice.source && link.document_id === choice.id)}
                onClick={() => void attach(choice)}>{choice.title}</Button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
