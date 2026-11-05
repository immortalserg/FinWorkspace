export function progressVariantForPercent(percent: number): 'primary' | 'warning' | 'destructive' {
  if (percent >= 100) return 'destructive'
  if (percent >= 80) return 'warning'
  return 'primary'
}
