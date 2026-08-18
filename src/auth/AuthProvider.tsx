import { useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

/** Die zuletzt bekannte Anmeldung, unabhängig vom Supabase-Client gemerkt.

    Hintergrund: Das Zugriffstoken läuft nach etwa einer Stunde ab. Ist man
    in dem Moment offline, schlägt der Refresh fehl und getSession() kann
    null liefern — man stünde mitten im Training vor der Anmeldeseite. Für
    eine App, deren oberste Priorität Offline-Fähigkeit ist, wäre das der
    schlimmste Ausfall. Deshalb: solange kein Netz da ist, gilt die
    gemerkte Anmeldung weiter. Geschrieben wird ohnehin nichts direkt —
    alle Änderungen liegen in der Warteschlange und gehen erst raus, wenn
    wieder Verbindung besteht; dann ist auch der Refresh wieder möglich. */
const MERK_SCHLUESSEL = 'benchProtocol.letzteAnmeldung'

function gemerkteAnmeldung(): User | null {
  try {
    const roh = localStorage.getItem(MERK_SCHLUESSEL)
    return roh ? (JSON.parse(roh) as User) : null
  } catch {
    return null
  }
}

function merkeAnmeldung(user: User | null) {
  try {
    if (user) localStorage.setItem(MERK_SCHLUESSEL, JSON.stringify(user))
    else localStorage.removeItem(MERK_SCHLUESSEL)
  } catch {
    // Privater Modus o. Ä. — dann eben ohne Gedächtnis.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [offlineUser, setOfflineUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        merkeAnmeldung(data.session.user)
      } else if (!navigator.onLine) {
        // Keine Sitzung, aber auch kein Netz: das kann genauso gut am
        // fehlgeschlagenen Token-Refresh liegen. Nicht abmelden.
        setOfflineUser(gemerkteAnmeldung())
      } else {
        merkeAnmeldung(null)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, neu) => {
      setSession(neu)
      if (neu) {
        setOfflineUser(null)
        merkeAnmeldung(neu.user)
      } else if (navigator.onLine) {
        // Echte Abmeldung nur, wenn wir tatsächlich mit dem Server reden
        // konnten — sonst weiterhin die gemerkte Anmeldung gelten lassen.
        setOfflineUser(null)
        merkeAnmeldung(null)
      } else {
        setOfflineUser(gemerkteAnmeldung())
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    session,
    user: session?.user ?? offlineUser,
    loading,
    signOut: async () => {
      merkeAnmeldung(null)
      setOfflineUser(null)
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
