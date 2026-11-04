export interface SplitPartDraft {
  amount: string
  categoryId: string
}

/** Cents, so 0.1 + 0.2 never lands at 0.30000000000000004. */
export function toCents(value: string): number {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function splitRemainderCents(parts: SplitPartDraft[], totalCents: number): number {
  return totalCents - parts.reduce((sum, part) => sum + toCents(part.amount), 0)
}

