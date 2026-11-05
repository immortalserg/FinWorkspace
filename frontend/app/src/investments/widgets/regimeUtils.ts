import type { RegimeBlock } from '../technicalApi'

export type RegimeBadge = 'strongUp' | 'up' | 'sideways' | 'down' | 'strongDown'

/**
 * The 5-way regime badge shared by the hero card and the executive summary —
 * derived once here so the two surfaces never disagree on what "strong
 * uptrend" means. `adx >= 25` is the same strong-trend threshold used
 * throughout docs/investments/03-technical-analysis.md.
 */
export function deriveRegimeBadge(regime: RegimeBlock): RegimeBadge {
  const strong = regime.adx != null && regime.adx >= 25
  if (regime.trend === 'up') return strong ? 'strongUp' : 'up'
  if (regime.trend === 'down') return strong ? 'strongDown' : 'down'
  return 'sideways'
}

