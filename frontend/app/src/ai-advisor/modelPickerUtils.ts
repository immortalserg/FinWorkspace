import type { ModelInfo } from './aiChatApi'

export type ModelSort = 'name' | 'price' | 'context'

export const SORTS: { id: ModelSort; labelKey: string }[] = [
  { id: 'name', labelKey: 'aiAdvisor.models.sortName' },
  { id: 'price', labelKey: 'aiAdvisor.models.sortPrice' },
  { id: 'context', labelKey: 'aiAdvisor.models.sortContext' },
]

export function compareModels(sort: ModelSort): (a: ModelInfo, b: ModelInfo) => number {
  // Unknown prices sort last when cheapest-first.
  const price = (m: ModelInfo) => m.prompt_per_m ?? Number.POSITIVE_INFINITY
  if (sort === 'price') return (a, b) => price(a) - price(b) || a.name.localeCompare(b.name)
  if (sort === 'context')
    return (a, b) => b.context_length - a.context_length || a.name.localeCompare(b.name)
  return (a, b) => a.name.localeCompare(b.name)
}

export function filterModels(models: ModelInfo[], query: string, sort: ModelSort): ModelInfo[] {
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? models.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(needle))
    : models
  return [...matches].sort(compareModels(sort))
}

