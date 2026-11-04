import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '../ui/Select'

import { normalizeDecimalSeparator } from './allocationUtils'
import type { AllocationRow } from './allocationUtils'

export function TransactionAllocationsEditor({ rows, onChange, total, categoryOptions }: {
  rows: AllocationRow[]
  onChange: (rows: AllocationRow[]) => void
  total: number
  categoryOptions: Array<{ value: string; label: string }>
}) {
  const { i18n, t } = useTranslation('transactions')
  const locale = i18n.resolvedLanguage || i18n.language || 'en'
  const allocated = rows.reduce((sum, row) => sum + (Number(row.amount.replace(',', '.')) || 0), 0)
  const update = (index: number, patch: Partial<AllocationRow>) =>
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="text-sm font-medium">{t('allocation.title')}</div>
      <div className="text-xs text-muted-foreground">
        {t('allocation.originalAmount', { amount: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(total) })}. {t('allocation.primaryAmount', { amount: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(total - allocated) })}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <div className="min-w-32 flex-1">
            <Select value={row.categoryId} onValueChange={value => update(index, { categoryId: value })}
              options={categoryOptions} placeholder={t('allocation.additionalCategory')} />
          </div>
          <Input className="w-24" inputMode="decimal" value={row.amount} placeholder={t('allocation.amount')}
            onChange={e => update(index, { amount: normalizeDecimalSeparator(e.target.value, locale) })} />
          <Input className="min-w-28 flex-1" value={row.notes} placeholder={t('allocation.note')}
            onChange={e => update(index, { notes: e.target.value })} />
          <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>{t('allocation.remove')}</Button>
        </div>
      ))}
      {allocated > total && <div className="text-xs text-destructive">{t('allocation.exceedsOriginal')}</div>}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...rows, { categoryId: '', amount: '', notes: '' }])}>{t('allocation.addCategory')}</Button>
    </div>
  )
}
