import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth-context'
import { Mark } from '../components/Mark'

type Verfahren = 'passwort' | 'magic'
type Modus = 'anmelden' | 'registrieren'

export function LoginPage() {
  const { user, loading: sessionLaedt } = useAuth()
  const location = useLocation()

  const [verfahren, setVerfahren] = useState<Verfahren>('passwort')
  const [modus, setModus] = useState<Modus>('anmelden')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [busy, setBusy] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'err' | 'ok'; text: string } | null>(null)

  if (!sessionLaedt && user) {
    const from = (location.state as { from?: Location })?.from
    return <Navigate to={from?.pathname ?? '/cockpit'} replace />
  }

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMeldung(null)
    try {
      if (verfahren === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMeldung({ art: 'ok', text: 'Link verschickt — E-Mail-Postfach prüfen.' })
      } else if (modus === 'anmelden') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: passwort,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMeldung({ art: 'ok', text: 'Konto angelegt — E-Mail zur Bestätigung prüfen.' })
      }
    } catch (err) {
      setMeldung({ art: 'err', text: err instanceof Error ? err.message : 'Unbekannter Fehler.' })
    } finally {
      setBusy(false)
    }
  }

  const passwortVergessen = async () => {
    if (!email) {
      setMeldung({ art: 'err', text: 'Erst E-Mail-Adresse eintragen.' })
      return
    }
    setBusy(true)
    setMeldung(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setMeldung({ art: 'ok', text: 'Link zum Zurücksetzen verschickt.' })
    } catch (err) {
      setMeldung({ art: 'err', text: err instanceof Error ? err.message : 'Unbekannter Fehler.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Mark />
          Bench<em>Protocol</em>
        </div>

        <div className="card">
          <div className="pills" role="group" aria-label="Anmeldeverfahren" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={'pill' + (verfahren === 'passwort' ? ' on' : '')}
              onClick={() => setVerfahren('passwort')}
            >
              Passwort
            </button>
            <button
              type="button"
              className={'pill' + (verfahren === 'magic' ? ' on' : '')}
              onClick={() => setVerfahren('magic')}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={e => void absenden(e)} className="stack">
            <div className="field">
              <label>E-Mail</label>
              <input
                className="inp big"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {verfahren === 'passwort' && (
              <div className="field">
                <label>Passwort</label>
                <input
                  className="inp big"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={modus === 'anmelden' ? 'current-password' : 'new-password'}
                  value={passwort}
                  onChange={e => setPasswort(e.target.value)}
                />
              </div>
            )}

            <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
              {verfahren === 'magic' ? 'Link zuschicken' : modus === 'anmelden' ? 'Anmelden' : 'Konto erstellen'}
            </button>

            {verfahren === 'passwort' && modus === 'anmelden' && (
              <button type="button" className="linkbtn" onClick={() => void passwortVergessen()}>
                Passwort vergessen?
              </button>
            )}

            {meldung && <p className={'auth-msg ' + meldung.art}>{meldung.text}</p>}
          </form>
        </div>

        {verfahren === 'passwort' && (
          <div className="auth-switch">
            {modus === 'anmelden' ? 'Noch kein Konto?' : 'Schon ein Konto?'}{' '}
            <button
              type="button"
              className="linkbtn"
              onClick={() => setModus(m => (m === 'anmelden' ? 'registrieren' : 'anmelden'))}
            >
              {modus === 'anmelden' ? 'Registrieren' : 'Anmelden'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
