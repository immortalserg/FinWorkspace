/**
 * Curated reference of endpoints an API key can call. Paths are relative to the
 * API base (`/api`). Every entry here is served by a router that accepts the
 * `X-API-Key` header; read-only keys are limited to GET.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiEndpoint {
  method: HttpMethod
  path: string
  descriptionKey: string
}

export interface ApiEndpointGroup {
  key: string
  endpoints: ApiEndpoint[]
}

export const API_ENDPOINT_GROUPS: ApiEndpointGroup[] = [
  {
    key: 'accounts',
    endpoints: [
      { method: 'GET', path: '/accounts/', descriptionKey: 'accountsList' },
      { method: 'GET', path: '/accounts/{id}/balance', descriptionKey: 'accountBalance' },
      { method: 'POST', path: '/accounts/', descriptionKey: 'accountCreate' },
    ],
  },
  {
    key: 'transactions',
    endpoints: [
      { method: 'GET', path: '/transactions/', descriptionKey: 'transactionsList' },
      { method: 'GET', path: '/transactions/income-vs-spending', descriptionKey: 'incomeSpending' },
      { method: 'POST', path: '/transactions/', descriptionKey: 'transactionCreate' },
      { method: 'PUT', path: '/transactions/{id}', descriptionKey: 'transactionEdit' },
      { method: 'DELETE', path: '/transactions/{id}', descriptionKey: 'transactionDelete' },
    ],
  },
  {
    key: 'budgets',
    endpoints: [
      { method: 'GET', path: '/budgets/', descriptionKey: 'budgetsList' },
      { method: 'GET', path: '/budgets/{id}/progress', descriptionKey: 'budgetProgress' },
    ],
  },
  {
    key: 'debts',
    endpoints: [
      { method: 'GET', path: '/debts/', descriptionKey: 'debtsList' },
      { method: 'GET', path: '/debts/summary', descriptionKey: 'debtsSummary' },
      { method: 'GET', path: '/debts/upcoming-payments', descriptionKey: 'upcomingPayments' },
    ],
  },
  {
    key: 'goals',
    endpoints: [
      { method: 'GET', path: '/goals/', descriptionKey: 'savingsGoals' },
      { method: 'GET', path: '/goals/summary', descriptionKey: 'goalsSummary' },
    ],
  },
  {
    key: 'categoriesRecurring',
    endpoints: [
      { method: 'GET', path: '/categories/', descriptionKey: 'categoriesList' },
      { method: 'GET', path: '/recurring-expenses/', descriptionKey: 'recurringList' },
      { method: 'GET', path: '/recurring-expenses/upcoming', descriptionKey: 'recurringUpcoming' },
    ],
  },
  {
    key: 'reports',
    endpoints: [
      { method: 'GET', path: '/reports/spending', descriptionKey: 'spendingReport' },
      { method: 'GET', path: '/reports/cashflow', descriptionKey: 'cashFlowReport' },
      { method: 'GET', path: '/reports/net-worth', descriptionKey: 'netWorthReport' },
      { method: 'GET', path: '/reports/savings-rate', descriptionKey: 'savingsRate' },
    ],
  },
  {
    key: 'investments',
    endpoints: [
      { method: 'GET', path: '/investments/accounts', descriptionKey: 'investmentAccounts' },
      { method: 'GET', path: '/investments/accounts/{id}/positions', descriptionKey: 'investmentPositions' },
    ],
  },
]

/** A copy-pasteable curl command for an endpoint. `origin` is e.g. https://finance.example.com. */
export function curlExample(endpoint: ApiEndpoint, origin: string, key = 'YOUR_API_KEY'): string {
  const url = `${origin}/api${endpoint.path}`
  const lines = [`curl${endpoint.method === 'GET' ? '' : ` -X ${endpoint.method}`} "${url}"`, `  -H "X-API-Key: ${key}"`]
  if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
    lines.push(`  -H "Content-Type: application/json"`, `  -d '{ ... }'`)
  }
  return lines.join(' \\\n')
}
