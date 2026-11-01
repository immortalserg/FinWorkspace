import { PaperlessTagPicker, togglePaperlessTag } from './PaperlessTagPicker'
import type { PaperlessTag } from './PaperlessTagPicker'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '../ui/Dialog'
import { PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { apiFetch } from '../lib/apiClient'

type Option = PaperlessTag
type Collection = { results: Option[] }
type Resource = 'tags' | 'document_types' | 'correspondents' | 'storage_paths'
type DocumentDetails = {
  id: number
  title: string
  document_type: number | null
  correspondent: number | null
  storage_path: number | null
  tags: number[]
}

const resources: { key: Resource; label: string; field: keyof DocumentDetails }[] = [
  { key: 'document_types', label: 'Document type', field: 'document_type' },
  { key: 'correspondents', label: 'Correspondent', field: 'correspondent' },
  { key: 'storage_paths', label: 'Storage path', field: 'storage_path' },
]

export function PaperlessEditDialog({
  documentId, onClose, onSaved,
}: {
  documentId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [details, setDetails] = useState<DocumentDetails | null>(null)
  const [options, setOptions] = useState<Record<Resource, Option[]>>({
    tags: [], document_types: [], correspondents: [], storage_paths: [],
  })
  const [newNames, setNewNames] = useState<Partial<Record<Resource, string>>>({})
  const [busy, setBusy] = useState(false)
  const [newTagParent, setNewTagParent] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      apiFetch<DocumentDetails>(`/paperless/documents/${documentId}`),
      ...(['tags', 'document_types', 'correspondents', 'storage_paths'] as Resource[])
        .map((key) => apiFetch<Collection>(`/paperless/${key}?page_size=100`)),
    ]).then(([doc, tags, types, correspondents, paths]) => {
      if (!active) return
      setDetails(doc as DocumentDetails)
      setOptions({
        tags: (tags as Collection).results ?? [],
        document_types: (types as Collection).results ?? [],
        correspondents: (correspondents as Collection).results ?? [],
        storage_paths: (paths as Collection).results ?? [],
      })
    }).catch(() => toast.error('Could not load document metadata'))
    return () => { active = false }
  }, [documentId])

  async function createOption(resource: Resource) {
    const name = newNames[resource]?.trim()
    if (!name || !details) return
    setBusy(true)
    try {
      const created = await apiFetch<Option>(`/paperless/${resource}`, {
        method: 'POST',
        body: JSON.stringify(resource === 'tags' ? { name, parent: newTagParent } : { name }),
      })
      setOptions((previous) => ({
        ...previous, [resource]: [...previous[resource], created],
      }))
      if (resource === 'tags') {
        setDetails((previous) => previous
          ? { ...previous, tags: togglePaperlessTag([...options.tags, { ...created, parent: newTagParent }], previous.tags, created.id, true) } : previous)
      } else {
        const field = resources.find((entry) => entry.key === resource)?.field
        if (field) setDetails((previous) => previous
          ? { ...previous, [field]: created.id } : previous)
      }
      setNewNames((previous) => ({ ...previous, [resource]: '' }))
      if (resource === 'tags') setNewTagParent(null)
      toast.success('Created')
    } catch {
      toast.error('Could not create metadata entry')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!details) return
    setBusy(true)
    try {
      await apiFetch(`/paperless/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: details.title,
          document_type: details.document_type,
          correspondent: details.correspondent,
          storage_path: details.storage_path,
          tags: details.tags,
        }),
      })
      toast.success('Document metadata saved')
      onSaved()
      onClose()
    } catch {
      toast.error('Could not save document metadata')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={true} title="Edit Paperless document" icon={PencilEdit02Icon} size="lg" onOpenChange={(open) => { if (!open) onClose() }} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!details || busy || !details.title.trim()} onClick={() => void save()}>Save changes</Button></>}>
      <div className="space-y-4">
        {!details ? <p>Loading metadata…</p> : (
          <>
            <label className="block text-sm">Title
              <Input className="mt-1" value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
            </label>
            {resources.map(({ key, label, field }) => (
              <div key={key} className="space-y-2">
                <label className="block text-sm">{label}
                  <select className="mt-1 w-full rounded border bg-background p-2" value={details[field] as number ?? ''} onChange={(event) => setDetails({ ...details, [field]: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">None</option>
                    {options[key].map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <div className="flex gap-2">
                  <input aria-label={`New ${label}`} placeholder={`New ${label.toLowerCase()}`} className="min-w-0 flex-1 rounded border bg-background p-2 text-sm" value={newNames[key] ?? ''} onChange={(event) => setNewNames({ ...newNames, [key]: event.target.value })} />
                  <Button size="sm" variant="outline" disabled={busy || !newNames[key]?.trim()} onClick={() => void createOption(key)}>Create</Button>
                </div>
              </div>
            ))}
            <fieldset className="space-y-2">
              <legend className="text-sm">Tags</legend>
              <PaperlessTagPicker tags={options.tags} selected={details.tags} onChange={(tags) => setDetails({ ...details, tags })} />
              <select aria-label="Parent tag" className="w-full rounded border bg-background p-2 text-sm" value={newTagParent ?? ''} onChange={(event) => setNewTagParent(event.target.value ? Number(event.target.value) : null)}>
                <option value="">No parent (root tag)</option>
                {options.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input aria-label="New tag" placeholder="New tag" className="min-w-0 flex-1 rounded border bg-background p-2 text-sm" value={newNames.tags ?? ''} onChange={(event) => setNewNames({ ...newNames, tags: event.target.value })} />
                <Button size="sm" variant="outline" disabled={busy || !newNames.tags?.trim()} onClick={() => void createOption('tags')}>Create tag</Button>
              </div>
            </fieldset>
          </>
        )}
      </div>
    </Dialog>
  )
}
