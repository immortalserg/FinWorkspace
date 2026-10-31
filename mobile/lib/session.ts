import * as SecureStore from 'expo-secure-store'

export type Tokens = { access_token: string; refresh_token: string; token_type: string }
const SESSION_KEY = 'finworkspace.jwt.v1'

export async function getTokens(): Promise<Tokens | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY)
  if (!value) return null
  try {
    const result = JSON.parse(value) as Tokens
    return result?.access_token && result.refresh_token ? result : null
  } catch {
    return null
  }
}

export async function setTokens(tokens: Tokens): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(tokens))
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}
