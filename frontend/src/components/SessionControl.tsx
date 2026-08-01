import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../api'

export function SessionControl() {
  const [user, setUser] = useState<{ username: string; role: string }>()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => { if (localStorage.getItem('onehealth_session')) api.me().then(setUser).catch(() => localStorage.removeItem('onehealth_session')) }, [])
  const submit = (event: FormEvent) => { event.preventDefault(); setError(undefined); api.login(username, password).then((result) => { localStorage.setItem('onehealth_session', result.access_token); setUser(result.user); setOpen(false); setPassword(''); window.location.reload() }).catch((reason: Error) => setError(reason.message)) }
  const logout = () => { localStorage.removeItem('onehealth_session'); setUser(undefined); window.location.reload() }

  if (user) return <div className="session-user"><span>{user.username}<small>{user.role}</small></span><button type="button" onClick={logout}>Sign out</button></div>
  return <div className="session-control"><button type="button" onClick={() => setOpen(!open)}>Sign in</button>{open && <form className="login-popover" onSubmit={submit}><strong>Protected EBS access</strong><small>Use your DHIS2 username and password.</small><label>Username<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Password<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button type="submit">Continue</button></form>}</div>
}
