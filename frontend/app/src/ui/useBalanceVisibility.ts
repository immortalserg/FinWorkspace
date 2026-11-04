import { useContext } from 'react'
import { BalanceVisibilityContext, type BalanceVisibilityValue } from './balanceVisibilityState'

export function useBalanceVisibility(): BalanceVisibilityValue {
  const ctx = useContext(BalanceVisibilityContext)
  if (!ctx) {
    throw new Error('useBalanceVisibility must be used within a BalanceVisibilityProvider')
  }
  return ctx
}
