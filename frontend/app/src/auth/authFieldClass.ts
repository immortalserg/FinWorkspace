import { cn } from '@/lib/utils'

/** Auth form field wrapper: a solid, high-contrast well against the flat page canvas. */
export function authFieldClass(hasError?: boolean) {
  return cn(
    'h-11 w-full items-center rounded-lg border bg-muted dark:bg-muted/70 transition-colors',
    hasError ? 'border-destructive' : 'border-border',
  )
}
