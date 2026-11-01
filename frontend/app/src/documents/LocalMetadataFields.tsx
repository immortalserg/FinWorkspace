import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '../lib/apiClient'

export type LocalMetadata = {
  created?: string
  document_type?: string
  correspondent?: string
  storage_path?: string
  tags?: string[]
  archive_serial_number?: number | null
  custom_fields?: Record<string, unknown>
}
type Definitions = Record<string, { name: string; data_type?: string; parent?: string | null }[]>
const catalog = [
  ['document_types', 'Document type', 'document_type'],
  ['correspondents', 'Correspondent', 'correspondent'],
  ['storage_paths', 'Storage path', 'storage_path'],
] as const

export function LocalMetadataFields({ value, onChange }: {
  value: LocalMetadata
  onChange: (value: LocalMetadata) => void
}) {
  const [definitions, setDefinitions] = useState<Definitions>({})
  const [newNames, setNewNames] = useState<Record<string, string>>({})
  const [tagParent, setTagParent] = useState('')
  useEffect(() => {
    void apiFetch<Definitions>('/documents/metadata/definitions')
      .then(setDefinitions).catch(() => {})
  }, [])
  async function addDefinition(key: string) {
    const name = (newNames[key] ?? '').trim()
    if (!name || (definitions[key] ?? []).some((x) => x.name.toLowerCase() === name.toLowerCase())) return
    const next = { ...definitions, [key]: [...(definitions[key] ?? []), { name, ...(key === 'custom_fields' ? { data_type: 'string' } : {}), ...(key === 'tags' ? { parent: tagParent || null } : {}) }] }
    try {
      await apiFetch('/documents/metadata/definitions', { method: 'PUT', body: JSON.stringify(next) })
      setDefinitions(next)
      setNewNames((prev) => ({ ...prev, [key]: '' }))
      if (key === 'tags') setTagParent('')
      if (key === 'tags') onChange({ ...value, tags: [...(value.tags ?? []), name] })
      else if (key !== 'custom_fields') {
        const field = catalog.find(([resource]) => resource === key)?.[2]
        if (field) onChange({ ...value, [field]: name })
      }
    } catch { /* Keep the current selection unchanged on API failure. */ }
  }
  return (
    <div className="space-y-3">
      <label className="block text-sm">Document date
        <Input className="mt-1" type="date" value={value.created?.slice(0, 10) ?? ''} onChange={(e) => onChange({ ...value, created: e.target.value })} />
      </label>
      {catalog.map(([key, label, field]) => (
        <div key={key} className="space-y-1">
          <label className="block text-sm">{label}
            <select className="mt-1 w-full rounded border bg-background p-2" value={value[field] ?? ''} onChange={(e) => onChange({ ...value, [field]: e.target.value })}>
              <option value="">None</option>
              {(definitions[key] ?? []).map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
              {value[field] && !(definitions[key] ?? []).some((x) => x.name === value[field]) && <option value={value[field]}>{value[field]}</option>}
            </select>
          </label>
          <div className="flex gap-2">
            <Input aria-label={`New ${label}`} placeholder={`New ${label.toLowerCase()}`} value={newNames[key] ?? ''} onChange={(e) => setNewNames({ ...newNames, [key]: e.target.value })} />
            <Button type="button" variant="outline" disabled={!newNames[key]?.trim()} onClick={() => void addDefinition(key)}>Add</Button>
          </div>
        </div>
      ))}
      <fieldset className="space-y-2">
        <legend className="text-sm">Tags</legend>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set([...(definitions.tags ?? []).map((x) => x.name), ...(value.tags ?? [])])).map((name) => (
            <label key={name} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={(value.tags ?? []).includes(name)} onChange={(e) => onChange({ ...value, tags: e.target.checked ? [...(value.tags ?? []), name] : (value.tags ?? []).filter((x) => x !== name) })} />{(definitions.tags ?? []).find((tag) => tag.name === name)?.parent ? `${(definitions.tags ?? []).find((tag) => tag.name === name)?.parent} / ` : ''}{name}
            </label>
          ))}
        </div>
        <select aria-label="Parent tag" className="w-full rounded border bg-background p-2 text-sm" value={tagParent} onChange={(e) => setTagParent(e.target.value)}>
          <option value="">No parent (root tag)</option>
          {(definitions.tags ?? []).map((tag) => <option key={tag.name} value={tag.name}>{tag.name}</option>)}
        </select>
        <div className="flex gap-2">
          <Input aria-label="New tag" placeholder="New tag" value={newNames.tags ?? ''} onChange={(e) => setNewNames({ ...newNames, tags: e.target.value })} />
          <Button type="button" variant="outline" onClick={() => void addDefinition('tags')}>Add</Button>
        </div>
      </fieldset>
      <label className="block text-sm">Archive serial number
        <Input className="mt-1" type="number" value={value.archive_serial_number ?? ''} onChange={(e) => onChange({ ...value, archive_serial_number: e.target.value ? Number(e.target.value) : null })} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm">Custom fields</legend>
        {(definitions.custom_fields ?? []).map((field) => (
          <label key={field.name} className="block text-sm">{field.name}
            {field.data_type === 'boolean' ? (
              <input className="ms-2" type="checkbox" checked={Boolean(value.custom_fields?.[field.name])} onChange={(e) => onChange({ ...value, custom_fields: { ...value.custom_fields, [field.name]: e.target.checked } })} />
            ) : (
              <Input className="mt-1" type={field.data_type === 'date' ? 'date' : field.data_type === 'integer' || field.data_type === 'float' ? 'number' : 'text'}
                value={String(value.custom_fields?.[field.name] ?? '')}
                onChange={(e) => onChange({ ...value, custom_fields: { ...value.custom_fields, [field.name]: field.data_type === 'integer' || field.data_type === 'float' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value } })} />
            )}
          </label>
        ))}
        <div className="flex gap-2">
          <Input aria-label="New custom field" placeholder="New custom field" value={newNames.custom_fields ?? ''} onChange={(e) => setNewNames({ ...newNames, custom_fields: e.target.value })} />
          <Button type="button" variant="outline" onClick={() => void addDefinition('custom_fields')}>Add</Button>
        </div>
      </fieldset>
    </div>
  )
}
