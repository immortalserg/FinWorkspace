import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { ICON_MAP, type IconKey } from './categoryIconData'

export function CategoryIcon({
  icon,
  color,
  className,
  size = 20,
}: {
  icon?: string | null
  color: string
  className?: string
  size?: number
}) {
  const iconKey = (icon && ICON_MAP[icon as IconKey]) || ICON_MAP.default

  return (
    <div
      className={cn(
        'flex size-9 items-center justify-center rounded-full shrink-0',
        'shadow-sm ring-1 ring-inset',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 22%, transparent)`,
        '--tw-ring-color': `color-mix(in oklch, ${color} 30%, transparent)`,
      } as React.CSSProperties}
    >
      <HugeiconsIcon
        icon={iconKey}
        size={size}
        strokeWidth={1.8}
        style={{ color }}
      />
    </div>
  )
}

