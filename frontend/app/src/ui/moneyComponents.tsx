import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '../lib/format'
import { categoryTint, flowSign, flowText, type Flow } from './moneyUtils'

/**
 * A currency figure set for scanning: tabular so decimals line up down a
 * column, and coloured by flow rather than by good/bad.
 */
export function Amount({
  value,
  flow,
  currency = 'EUR',
  signed = true,
  muted = false,
  className,
}: {
  value: number
  flow?: Flow
  currency?: string
  signed?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-medium tabular-nums slashed-zero',
        muted ? 'text-muted-foreground' : flow ? flowText[flow] : 'text-foreground',
        className,
      )}
    >
      {signed && flow ? flowSign[flow] : ''}
      {formatCurrency(value, currency)}
    </span>
  )
}

export function CategoryChip({
  name,
  color,
  className,
  children,
}: {
  name: string | null | undefined
  color?: string | null
  className?: string
  children?: ReactNode
}) {
  if (!name) {
    return <span className={cn('text-sm text-muted-foreground', className)}>—</span>
  }
  return (
    <span
      style={categoryTint(color)}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        !color && 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {color && (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      <span className="truncate">{name}</span>
      {children}
    </span>
  )
}
