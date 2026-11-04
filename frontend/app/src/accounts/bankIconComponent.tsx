import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import type { AccountType } from './accountsApi'
import { bankIconSrc, getAccountTypeMeta } from './bankIconData'

export function AccountIcon({
  icon,
  type,
  className,
  imageClassName,
}: {
  icon?: string | null
  type: AccountType
  className?: string
  imageClassName?: string
}) {
  const meta = getAccountTypeMeta(type)
  const src = bankIconSrc(icon)

  if (src) {
    return (
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xs dark:bg-white/10',
          className,
        )}
      >
        <img src={src} alt="" className={cn('size-9 object-contain', imageClassName)} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-2xl',
        'shadow-xs',
        meta.tint,
        className,
      )}
    >
      <HugeiconsIcon icon={meta.icon} strokeWidth={2} />
    </div>
  )
}
