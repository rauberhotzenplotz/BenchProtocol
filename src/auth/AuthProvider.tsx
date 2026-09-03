import { useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { serverErreichbar } from '../lib/offline/netz'
import { AuthContext, type AuthState } from './auth-context'

/** Die zuletzt bekannte Anmeldung, unabhängig vom Supabase-Client gemerkt.

    Hintergrund: Das Zugriffstoken läuft nach etwa einer Stunde ab. Ist man
    in dem Moment offline, schlägt der Refresh fehl und getSession() kann
    null liefern — man stünde mitten im Training vor der Anmeldeseite. Für
    eine App, deren oberste Priorität Offline-Fähigkeit ist, wäre das der
    schlimmste Ausfall. Deshalb: solange der Server nicht erreichbar ist,
    gilt die gemerkte Anmeldung weiter. Geschrieben wird ohnehin nichts
    direkt — alle Änderungen liegen in der Warteschlange und gehen erst
    raus, wenn wieder Verbindung besteht; dann ist auch der Refresh wieder
    möglich. */
const MERK_SCHLUESSEL = 'benchProtocol.letzteAnmeldung'

/** Spätestens danach wird ohne Ergebnis von getSession() weitergemacht.

    getSession() versucht bei abgelaufenem Token einen Refresh. Ohne Netz
    kann dieser Aufruf in der Android-WebView hängen bleiben, und solange
    steht `loading` — RequireAuth rendert dann nichts, die App zeigt einen
    leeren Bildschirm. Der Notausgang bricht das ab und macht mit der
    gemerkten Anmeldung weiter; ein später doch noch eintreffendes
    Ergebnis wird trotzdem übernommen. */
const START_TIMEOUT = 3500

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
    let abgeraeumt = false

    /** Keine Sitzung — aber heißt das "abgemeldet" oder "kein Netz"?

        Früher entschied das navigator.onLine. Genau das ist die Angabe,
        die in der Android-WebView auch ohne Verbindung true meldet (siehe
        offline/netz.ts): Die App hielt sich für online, löschte die
        gemerkte Anmeldung und stand beim Start ohne Netz vor der
        Anmeldeseite — die ihrerseits Netz braucht. Deshalb wird hier
        gemessen statt geraten. Der onlineManager taugt an dieser Stelle
        noch nicht: Seine erste Messung läuft beim Start selbst noch, bis
        dahin meldet er optimistisch "online". */
    const ohneSitzung = async () => {
      const erreichbar = await serverErreichbar()
      if (abgeraeumt) return
      if (erreichbar) {
        merkeAnmeldung(null)
        setOfflineUser(null)
      } else {
        setOfflineUser(gemerkteAnmeldung())
      }
    }

    const notausgang = setTimeout(() => {
      if (abgeraeumt) return
      setOfflineUser(alt => alt ?? gemerkteAnmeldung())
      setLoading(false)
    }, START_TIMEOUT)

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (abgeraeumt) return
        if (data.session) {
          setSession(data.session)
          merkeAnmeldung(data.session.user)
        } else {
          await ohneSitzung()
        }
      })
      .catch(async () => {
        // Ein geworfener Fehler ist praktisch immer ein Netzfehler —
        // dieselbe Behandlung wie eine fehlende Sitzung.
        if (!abgeraeumt) await ohneSitzung()
      })
      .finally(() => {
        clearTimeout(notausgang)
        if (!abgeraeumt) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, neu) => {
      setSession(neu)
      if (neu) {
        setOfflineUser(null)
        merkeAnmeldung(neu.user)
      } else {
        // Auch hier: eine verschwundene Sitzung ist ohne Messung kein
        // Beweis für eine Abmeldung.
        void ohneSitzung()
      }
    })

    return () => {
      abgeraeumt = true
      clearTimeout(notausgang)
      sub.subscription.unsubscribe()
    }
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
