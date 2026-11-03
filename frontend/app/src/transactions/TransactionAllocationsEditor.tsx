import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '../ui/Select'
import type { TransactionAllocation } from './transactionsApi'

export type AllocationRow = { categoryId: string; amount: string; notes: string }
export const allocationRows = (allocations: TransactionAllocation[] = []): AllocationRow[] =>
  allocations.map(a => ({ categoryId: String(a.category_id), amount: a.amount.toFixed(2), notes: a.notes ?? '' }))

export function parseAllocations(rows: AllocationRow[], total: number, primaryCategory: string) {
  const sum = rows.reduce((value, row) => value + Math.round(Number(row.amount.replace(',', '.')) * 100), 0)
  if (rows.some(row => !row.categoryId || !/^\d+([.,]\d{1,2})?$/.test(row.amount.trim()) ||
    !Number.isFinite(Number(row.amount.replace(',', '.'))) || Number(row.amount.replace(',', '.')) <= 0)) {
    throw new Error('Укажите категорию и положительную сумму с точностью до двух знаков')
  }
  if (sum > Math.round(total * 100)) throw new Error('Распределение превышает сумму транзакции')
  if (rows.length && !primaryCategory) throw new Error('Выберите основную категорию')
  return rows.map(row => ({ category_id: Number(row.categoryId), amount: Math.round(Number(row.amount.replace(',', '.')) * 100) / 100, notes: row.notes || null }))
}

export function TransactionAllocationsEditor({ rows, onChange, total, categoryOptions }: {
  rows: AllocationRow[]
  onChange: (rows: AllocationRow[]) => void
  total: number
  categoryOptions: Array<{ value: string; label: string }>
}) {
  const allocated = rows.reduce((sum, row) => sum + (Number(row.amount.replace(',', '.')) || 0), 0)
  const update = (index: number, patch: Partial<AllocationRow>) =>
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="text-sm font-medium">Распределение по категориям</div>
      <div className="text-xs text-muted-foreground">
        Исходная сумма: {total.toFixed(2)}. Основная категория: {(total - allocated).toFixed(2)}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <div className="min-w-32 flex-1">
            <Select value={row.categoryId} onValueChange={value => update(index, { categoryId: value })}
              options={categoryOptions} placeholder="Дополнительная категория" />
          </div>
          <Input className="w-24" inputMode="decimal" value={row.amount} placeholder="Сумма"
            onChange={e => update(index, { amount: e.target.value })} />
          <Input className="min-w-28 flex-1" value={row.notes} placeholder="Примечание"
            onChange={e => update(index, { notes: e.target.value })} />
          <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Удалить</Button>
        </div>
      ))}
      {allocated > total && <div className="text-xs text-destructive">Сумма распределения превышает исходную.</div>}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...rows, { categoryId: '', amount: '', notes: '' }])}>+ Категория</Button>
    </div>
  )
}
