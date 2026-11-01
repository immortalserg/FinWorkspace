import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** The one-time code is in the URL fragment, never sent in HTTP requests. */
export function MobileAuthPage() {
  const { acceptMobileSession } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = new URLSearchParams(window.location.hash.slice(1)).get('code')
    window.history.replaceState(null, '', '/mobile-auth')
    if (!code) { setError('Missing mobile login code'); return }
    void acceptMobileSession(code)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setError('Mobile session expired. Return to the app and sign in again.'))
  }, [acceptMobileSession, navigate])

  return <main style={{ padding: 32 }}>
    {error || 'Signing in to FinWorkspace…'}
  </main>
}
