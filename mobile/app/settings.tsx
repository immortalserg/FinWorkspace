import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { loadServerSettings, saveServerSettings } from '../lib/config'
import { clearTokens } from '../lib/session'

export default function Settings() {
  const [remote, setRemote] = useState('')
  const [local, setLocal] = useState('')
  const [ssids, setSsids] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { void loadServerSettings().then(s => {
    setRemote(s.remoteUrl); setLocal(s.localUrl); setSsids(s.trustedSsids.join('\n'))
  }) }, [])

  async function save() {
    try {
      await saveServerSettings({ remoteUrl: remote, localUrl: local, trustedSsids: ssids.split(/[,\n]/) })
      setMessage('Saved. The correct address will be selected automatically.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Invalid configuration') }
  }

  async function allowWifi() {
    const result = await Location.requestForegroundPermissionsAsync()
    setMessage(result.granted ? 'Permission granted. SSID detection may still require OS configuration.' : 'Permission denied; remote address will be used.')
  }

  async function logout() {
    await clearTokens()
    router.replace('/')
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Server connection</Text>
    <Text style={styles.label}>Remote address (HTTPS)</Text>
    <TextInput style={styles.input} value={remote} onChangeText={setRemote} placeholder="https://finance.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
    <Text style={styles.label}>Local address</Text>
    <TextInput style={styles.input} value={local} onChangeText={setLocal} placeholder="https://finance.home.arpa" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
    <Text style={styles.label}>Trusted Wi-Fi names (one SSID per line)</Text>
    <TextInput style={[styles.input, styles.multiline]} multiline value={ssids} onChangeText={setSsids} placeholder={'Home WiFi\nHome WiFi 5G'} />
    <Text style={styles.note}>When connected to one of these Wi-Fi networks, FinWorkspace tests the local server first. If the network cannot be identified or the server is unreachable, it uses the remote URL.</Text>
    <Pressable style={styles.button} onPress={() => void allowWifi()}><Text style={styles.buttonText}>Allow Wi-Fi detection</Text></Pressable>
    <Pressable style={styles.button} onPress={() => void save()}><Text style={styles.buttonText}>Save settings</Text></Pressable>
    <Pressable style={styles.logout} onPress={() => void logout()}><Text style={styles.buttonText}>Sign out</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </ScrollView>
}
const styles = StyleSheet.create({
  page: { backgroundColor: '#f4f8fb' }, content: { padding: 22, gap: 12 },
  heading: { fontSize: 26, fontWeight: '800', color: '#102d4b', marginBottom: 14 },
  label: { fontWeight: '600', color: '#334155' }, input: { backgroundColor: 'white', borderRadius: 10, borderColor: '#cbd5e1', borderWidth: 1, padding: 14 },
  multiline: { minHeight: 90, textAlignVertical: 'top' }, note: { color: '#64748b', lineHeight: 21, marginVertical: 10 },
  button: { backgroundColor: '#145b94', padding: 15, borderRadius: 10, alignItems: 'center' },
  logout: { backgroundColor: '#9f3342', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '700' }, message: { marginTop: 10, color: '#334155' },
})
