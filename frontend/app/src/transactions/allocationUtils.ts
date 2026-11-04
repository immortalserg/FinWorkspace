import type { TransactionAllocation } from './transactionsApi'

export type AllocationRow = { categoryId: string; amount: string; notes: string }
export const decimalSeparator = (locale: string): string =>
  new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.'

export const normalizeDecimalSeparator = (value: string, locale: string): string =>
  value.replace(/[.,]/g, decimalSeparator(locale))

export const allocationRows = (allocations: TransactionAllocation[] = [], locale = 'en'): AllocationRow[] =>
  allocations.map(a => ({
    categoryId: String(a.category_id),
    amount: normalizeDecimalSeparator(String(Number(a.amount)), locale),
    notes: a.notes ?? '',
  }))

export function parseAllocations(rows: AllocationRow[], total: number, primaryCategory: string, translate: (key: string) => string = key => key) {
  const sum = rows.reduce((value, row) => value + Math.round(Number(row.amount.replace(',', '.')) * 100), 0)
  if (rows.some(row => !row.categoryId || !/^\d+([.,]\d{1,2})?$/.test(row.amount.trim()) ||
    !Number.isFinite(Number(row.amount.replace(',', '.'))) || Number(row.amount.replace(',', '.')) <= 0)) {
    throw new Error(translate('allocation.invalidAmount'))
  }
  if (sum > Math.round(total * 100)) throw new Error(translate('allocation.exceedsTransaction'))
  if (rows.length && !primaryCategory) throw new Error(translate('allocation.choosePrimary'))
  return rows.map(row => ({ category_id: Number(row.categoryId), amount: Math.round(Number(row.amount.replace(',', '.')) * 100) / 100, notes: row.notes || null }))
}

