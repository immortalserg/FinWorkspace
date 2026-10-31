import * as Location from 'expo-location'
import * as Network from 'expo-network'
import type { ServerSettings } from './config'

async function currentSsid(): Promise<string | null> {
  try {
    const state = await Network.getNetworkStateAsync()
    if (!state.isConnected || state.type !== Network.NetworkStateType.WIFI) return null
    const permission = await Location.getForegroundPermissionsAsync()
    if (!permission.granted) return null
    const ssid = await Network.getCurrentWifiSSIDAsync()
    return ssid || null
  } catch {
    return null
  }
}

async function reachable(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2200)
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal, cache: 'no-store' })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Prefer local only when connected to a configured SSID AND the server is
 * reachable. SSID is never treated as proof of identity.
 */
export async function selectServer(config: ServerSettings): Promise<string> {
  if (config.localUrl && config.trustedSsids.length) {
    const ssid = await currentSsid()
    if (ssid && config.trustedSsids.includes(ssid) && await reachable(config.localUrl)) {
      return config.localUrl
    }
  }
  return config.remoteUrl
}
