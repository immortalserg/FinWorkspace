import { loadServerSettings } from './config'
import { selectServer } from './connection'
import { clearTokens, getTokens, setTokens, type Tokens } from './session'

let pendingRefresh: Promise<Tokens> | undefined

async function endpoint(): Promise<string> {
  const config = await loadServerSettings()
  if (!config.remoteUrl) throw new Error('Configure your server in Settings')
  return selectServer(config)
}

export async function signIn(email: string, password: string): Promise<void> {
  const base = await endpoint()
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Incorrect email or password' : `Login failed (${response.status})`)
  await setTokens(await response.json() as Tokens)
}

async function renew(): Promise<Tokens> {
  if (!pendingRefresh) {
    pendingRefresh = (async () => {
      const old = await getTokens()
      if (!old) throw new Error('Session expired')
      const base = await endpoint()
      const response = await fetch(`${base}/api/auth/refresh?refresh_token=${encodeURIComponent(old.refresh_token)}`, { method: 'POST' })
      if (!response.ok) {
        await clearTokens()
        throw new Error('Session expired. Please sign in again.')
      }
      const tokens = await response.json() as Tokens
      await setTokens(tokens)
      return tokens
    })().finally(() => { pendingRefresh = undefined })
  }
  return pendingRefresh
}

export async function apiGet<T>(path: string): Promise<T> {
  const old = await getTokens()
  if (!old) throw new Error('Please sign in')
  const base = await endpoint()
  let response = await fetch(`${base}/api${path}`, { headers: { Authorization: `Bearer ${old.access_token}` } })
  if (response.status === 401) {
    const updated = await renew()
    response = await fetch(`${base}/api${path}`, { headers: { Authorization: `Bearer ${updated.access_token}` } })
  }
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return await response.json() as T
}
