import * as SecureStore from 'expo-secure-store'

export type ServerSettings = {
  remoteUrl: string
  localUrl: string
  trustedSsids: string[]
}

const KEY = 'finworkspace.server.v1'

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim())
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP(S) is supported')
  if (url.username || url.password || url.search || url.hash) throw new Error('Use a server origin, not a URL with credentials, query or hash')
  return url.origin + url.pathname.replace(/\/+$/, '')
}

export async function loadServerSettings(): Promise<ServerSettings> {
  const saved = await SecureStore.getItemAsync(KEY)
  if (!saved) return { remoteUrl: '', localUrl: '', trustedSsids: [] }
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid configuration')
    const data = parsed as Partial<ServerSettings>
    return {
      remoteUrl: typeof data.remoteUrl === 'string' ? data.remoteUrl : '',
      localUrl: typeof data.localUrl === 'string' ? data.localUrl : '',
      trustedSsids: Array.isArray(data.trustedSsids) ? data.trustedSsids.filter((s): s is string => typeof s === 'string') : [],
    }
  } catch {
    return { remoteUrl: '', localUrl: '', trustedSsids: [] }
  }
}

export async function saveServerSettings(value: ServerSettings): Promise<void> {
  const remoteUrl = normalizeBaseUrl(value.remoteUrl)
  const localUrl = value.localUrl.trim() ? normalizeBaseUrl(value.localUrl) : ''
  if (remoteUrl.startsWith('http:')) throw new Error('Remote address must use HTTPS')
  await SecureStore.setItemAsync(KEY, JSON.stringify({
    remoteUrl, localUrl,
    trustedSsids: [...new Set(value.trustedSsids.map(s => s.trim()).filter(Boolean))],
  }))
}
