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

