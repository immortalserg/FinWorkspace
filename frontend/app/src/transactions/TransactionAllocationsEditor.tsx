import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '../ui/Select'
import type { Transaction } from './transactionsApi'
import { useUpdateTransactionAllocations } from './useTransactions'

type Row = { categoryId: string; amount: string; notes: string }
const cents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100)

export function TransactionAllocationsEditor({
  transaction, categoryOptions,
}: {
  transaction: Transaction
  categoryOptions: Array<{ value: string; label: string }>
}) {
  const mutation = useUpdateTransactionAllocations()
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (dirty) return
    setRows((transaction.allocations ?? []).map(a => ({
      categoryId: String(a.category_id),
      amount: a.amount.toFixed(2),
      notes: a.notes ?? '',
    })))
  }, [transaction.id, transaction.allocations, dirty])
  const total = Math.round(transaction.amount * 100)
  const amountsValid = rows.every(r => r.categoryId && r.amount.trim() &&
    Number.isFinite(cents(r.amount)) && cents(r.amount) > 0 &&
    /^\d+([.,]\d{1,2})?$/.test(r.amount.trim()))
  const allocated = rows.reduce((sum, r) => sum + (Number.isFinite(cents(r.amount)) ? cents(r.amount) : 0), 0)
  const remaining = total - allocated
  const valid = amountsValid && remaining >= 0 && (!rows.length || Boolean(transaction.category_id))
  const update = (index: number, patch: Partial<Row>) => {
    setDirty(true)
    setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  async function save() {
    if (!valid) return
    try {
      await mutation.mutateAsync({
        id: transaction.id,
        allocations: rows.map(row => ({
          category_id: Number(row.categoryId),
          amount: cents(row.amount) / 100,
          notes: row.notes || null,
        })),
      })
      setDirty(false)
      toast.success('Распределение по категориям сохранено')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить распределение')
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="text-sm font-medium">Распределение по категориям</div>
      <div className="text-xs text-muted-foreground">
        Исходная сумма: {(total / 100).toFixed(2)}. Основная категория:
        {' '}{(remaining / 100).toFixed(2)}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <div className="min-w-32 flex-1">
            <Select value={row.categoryId}
              onValueChange={value => update(index, { categoryId: value })}
              options={categoryOptions} placeholder="Дополнительная категория" />
          </div>
          <Input className="w-24" inputMode="decimal" value={row.amount}
            placeholder="Сумма" onChange={e => update(index, { amount: e.target.value })} />
          <Input className="min-w-28 flex-1" value={row.notes} placeholder="Примечание"
            onChange={e => update(index, { notes: e.target.value })} />
          <Button type="button" variant="ghost"
            onClick={() => { setDirty(true); setRows(current => current.filter((_, i) => i !== index)) }}>
            Удалить
          </Button>
        </div>
      ))}
      {remaining < 0 && <div className="text-xs text-destructive">Сумма распределения превышает исходную.</div>}
      {rows.length > 0 && !transaction.category_id && (
        <div className="text-xs text-destructive">Сначала сохраните основную категорию транзакции.</div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm"
          onClick={() => { setDirty(true); setRows(current => [...current, { categoryId: '', amount: '', notes: '' }]) }}>
          + Категория
        </Button>
        <Button type="button" size="sm" disabled={!valid || mutation.isPending}
          onClick={() => void save()}>
          Сохранить распределение
        </Button>
      </div>
    </div>
  )
}
