import type { CSSProperties } from 'react'

/**
 * The direction money moved. Every money-bearing row in the app is marked with
 * one of these three, using the same hue in its rail, its amount, and its icon
 * chip — so a column of rails can be read top to bottom as a flow.
 */
export type Flow = 'in' | 'out' | 'move'

export function flowOfType(type: 'income' | 'expense' | 'transfer'): Flow {
  if (type === 'income') return 'in'
  if (type === 'transfer') return 'move'
  return 'out'
}

/** Left spine marking flow direction. Signature device of the money pages. */
export const flowRail: Record<Flow, string> = {
  in: 'border-s-[3px] border-s-flow-in',
  out: 'border-s-[3px] border-s-flow-out',
  move: 'border-s-[3px] border-s-flow-move',
}

export const flowText: Record<Flow, string> = {
  in: 'text-flow-in',
  out: 'text-flow-out',
  move: 'text-flow-move',
}

export const flowSurface: Record<Flow, string> = {
  in: 'bg-flow-in/10 text-flow-in border-flow-in/25',
  out: 'bg-flow-out/10 text-flow-out border-flow-out/25',
  move: 'bg-flow-move/10 text-flow-move border-flow-move/25',
}

export const flowSign: Record<Flow, string> = { in: '+', out: '−', move: '' }

/**
 * Tints derived from a category's own colour. Categories are a genuinely
 * categorical dimension, so they get real hues from the user's data instead of
 * one shared grey. color-mix keeps them legible on either theme.
 */
export function categoryTint(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined
  return {
    '--cat': color,
    backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
    borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
    color: `color-mix(in oklab, ${color} 72%, var(--foreground))`,
  } as CSSProperties
}

