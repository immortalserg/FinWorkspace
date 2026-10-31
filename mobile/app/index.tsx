import { useEffect, useState } from 'react'
import { Link, router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiGet, signIn } from '../lib/api'
import { getTokens } from '../lib/session'

type CurrentUser = { email: string; full_name: string | null }

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try { setUser(await apiGet<CurrentUser>('/auth/me')); setError('') }
    catch (e) { setUser(null); setError(e instanceof Error ? e.message : 'Unable to connect') }
    finally { setLoading(false) }
  }

  useEffect(() => { void getTokens().then(t => { if (t) void load(); else setLoading(false) }) }, [])

  async function login() {
    setLoading(true)
    try { await signIn(email, password); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); setLoading(false) }
  }

  return <View style={styles.root}>
    <Text style={styles.title}>FinWorkspace</Text>
    <Text style={styles.subtitle}>Your finances, on your server</Text>
    {loading ? <ActivityIndicator size="large" /> : user ?
      <><Text style={styles.welcome}>Welcome, {user.full_name || user.email}</Text>
      <Text style={styles.hint}>Mobile client connected successfully.</Text>
      <Pressable style={styles.button} onPress={() => router.push('/settings')}><Text style={styles.buttonText}>Server settings</Text></Pressable></> :
      <><TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <Pressable style={styles.button} onPress={() => void login()}><Text style={styles.buttonText}>Sign in</Text></Pressable></>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Link href="/settings" style={styles.link}>Configure server & Wi-Fi networks</Link>
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#f4f8fb' },
  title: { fontWeight: '800', fontSize: 32, color: '#102d4b', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 16, marginBottom: 40 },
  welcome: { fontSize: 20, color: '#102d4b', marginBottom: 10 },
  hint: { color: '#64748b', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 },
  button: { backgroundColor: '#145b94', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 16 },
  link: { color: '#145b94', marginTop: 30, textAlign: 'center' },
})
