/** No dedicated i18n key for a bare "weak/moderate/strong" word exists — the
 * locale only has full sentences (`regime.strength*`) — so this is a small
 * inline fallback rather than a new shared key. Exported so `IndicatorPane`'s
 * RSI caption (which reuses the same `signal.detail_key` templates that
 * interpolate `{{state}}`) stays in sync with this panel instead of carrying
 * a second copy of the same three-way split. */
export function adxStrengthLabel(adx: number): string {
  if (adx < 20) return 'weak'
  if (adx < 25) return 'moderate'
  return 'strong'
}

