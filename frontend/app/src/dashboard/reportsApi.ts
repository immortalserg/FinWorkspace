import { apiFetch } from '../lib/apiClient'

export interface SpendingReport {
  labels: string[]
  data: number[]
  transaction_count?: number
}

export interface CurrencySpendingReport {
  categories: Record<string, string>
  currencies: Record<string, Record<string, number>>
}

export function getSpendingByCurrency(params: { start_date?: string; end_date?: string } = {}): Promise<CurrencySpendingReport> {
  return apiFetch<CurrencySpendingReport>(`/reports/spending-by-currency${buildQueryString(params)}`)
}

export interface SpendingReportParams {
  currency?: string
  start_date?: string
  end_date?: string
  account_ids?: string
  category_ids?: string
}

export interface CashflowReport {
  labels: string[]
  income: number[]
  expenses: number[]
}

export interface CurrencyCashflowReport {
  currencies: Record<string, { income: number; expenses: number }>
}

export function getCashflowByCurrency(params: { start_date?: string; end_date?: string } = {}): Promise<CurrencyCashflowReport> {
  return apiFetch<CurrencyCashflowReport>(`/reports/cashflow-by-currency${buildQueryString(params)}`)
}

export interface CashflowReportParams {
  currency?: string
  start_date?: string
  end_date?: string
  group_by?: 'day' | 'week' | 'month'
}

export interface NetWorthReport {
  labels: string[]
  data: number[]
}

export interface NetWorthReportParams {
  start_date?: string
  end_date?: string
}

function buildQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, string | undefined>)) {
    if (value !== undefined && value !== '') {
      search.set(key, value)
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function getSpendingReport(params: SpendingReportParams = {}): Promise<SpendingReport> {
  return apiFetch<SpendingReport>(`/reports/spending${buildQueryString(params)}`)
}

export function getCashflowReport(params: CashflowReportParams = {}): Promise<CashflowReport> {
  return apiFetch<CashflowReport>(
    `/reports/cashflow${buildQueryString({
      start_date: params.start_date,
      end_date: params.end_date,
      group_by: params.group_by ?? 'month',
      currency: params.currency,
    })}`,
  )
}

export function getNetWorthReport(params: NetWorthReportParams = {}): Promise<NetWorthReport> {
  return apiFetch<NetWorthReport>(`/reports/net-worth${buildQueryString(params)}`)
}
