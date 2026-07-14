import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await fn
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Check your email to confirm your account.')
    setBusy(false)
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>📝 Notes</h1>
        <p className="muted">{mode === 'signin' ? 'Sign in to your notes' : 'Create your account'}</p>
        <input type="email" placeholder="Email" value={email} required
          onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password (min 6 chars)" value={password} required minLength={6}
          onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        {msg && <p className="auth-msg">{msg}</p>}
        <button type="button" className="btn link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
