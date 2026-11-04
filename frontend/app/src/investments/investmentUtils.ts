/** The largest absolute gain/loss in a set, i.e. the shared scale for `DeltaBar`. */
export function deltaScale(values: Array<number | null | undefined>): number {
  return values.reduce<number>((max, v) => (v == null ? max : Math.max(max, Math.abs(v))), 0)
}

