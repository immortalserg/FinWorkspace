import { createContext } from 'react'

export interface BalanceVisibilityValue {
  hidden: boolean
  toggle: () => void
}

export const BalanceVisibilityContext = createContext<BalanceVisibilityValue | null>(null)
