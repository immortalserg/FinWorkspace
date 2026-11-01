import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export type PaperlessTag = { id: number; name: string; parent?: number | null }

export function togglePaperlessTag(tags: PaperlessTag[], selected: number[], id: number, checked: boolean): number[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const next = new Set(selected)
  if (checked) {
    let current: number | null | undefined = id
    const seen = new Set<number>()
    while (current != null && !seen.has(current)) {
      seen.add(current)
      next.add(current)
      current = byId.get(current)?.parent
    }
  } else {
    for (const candidate of next) {
      let current: number | null | undefined = candidate
      const seen = new Set<number>()
      while (current != null && !seen.has(current)) {
        if (current === id) { next.delete(candidate); break }
        seen.add(current)
        current = byId.get(current)?.parent
      }
    }
  }
  return [...next]
}

export function PaperlessTagPicker({ tags, selected, onChange }: {
  tags: PaperlessTag[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number[]>([])
  const ids = new Set(tags.map((tag) => tag.id))
  const children = (parent: number | null) => tags.filter((tag) =>
    (tag.parent != null && ids.has(tag.parent) ? tag.parent : null) === parent)
  const renderBranch = (parent: number | null, depth: number, visited: Set<number>): ReactNode =>
    children(parent).filter((tag) => !visited.has(tag.id)).map((tag) => {
      const path = new Set([...visited, tag.id])
      const hasChildren = children(tag.id).some((child) => !path.has(child.id))
      const isExpanded = expanded.includes(tag.id)
      return (
        <div key={tag.id}>
          <div className="flex min-h-8 items-center gap-1 rounded px-1 hover:bg-muted/50" style={{ paddingInlineStart: `${depth * 16 + 4}px` }}>
            {hasChildren ? (
              <button type="button" className="flex size-6 shrink-0 items-center justify-center"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${tag.name}`}
                onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : <span className="inline-block w-6 shrink-0" />}
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(tag.id)}
                onChange={(event) => onChange(togglePaperlessTag(tags, selected, tag.id, event.target.checked))} />
              <span className="truncate" title={tag.name}>{tag.name}</span>
            </label>
          </div>
          {hasChildren && isExpanded && renderBranch(tag.id, depth + 1, path)}
        </div>
      )
    })
  return (
    <div>
      <Button type="button" variant="outline" className="w-full justify-between text-start" aria-expanded={open}
        onClick={() => setOpen((current) => !current)}>
        <span className="truncate">{selected.length ? `Selected tags: ${selected.length}` : 'Select tags'}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </Button>
      {open && <div className="mt-1 max-h-72 overflow-y-auto rounded-lg border bg-background p-2 shadow-sm">
        {tags.length ? renderBranch(null, 0, new Set()) : <p className="p-2 text-xs text-muted-foreground">No tags yet</p>}
      </div>}
    </div>
  )
}
