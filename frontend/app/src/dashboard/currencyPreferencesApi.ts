import { apiFetch } from '../lib/apiClient'

export interface CurrencyPreferences {
  mode: 'converted' | 'separate' | 'both'
  base: string
}

export function getCurrencyPreferences(): Promise<CurrencyPreferences> {
  return apiFetch<CurrencyPreferences>('/auth/me/currency-preferences')
}

export function updateCurrencyPreferences(value: CurrencyPreferences): Promise<CurrencyPreferences> {
  return apiFetch<CurrencyPreferences>('/auth/me/currency-preferences', {
    method: 'PUT',
    body: JSON.stringify(value),
  })
}
