import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

/** Verlässliche Erkennung, ob der Server gerade erreichbar ist.

    Warum nicht einfach navigator.onLine: Auf dem Android-Testgerät meldet
    die WebView `navigator.onLine === true`, obwohl WLAN und mobile Daten
    aus sind und jeder fetch() sofort scheitert (nachgemessen). TanStack
    Query verlässt sich standardmäßig genau darauf und hält sich deshalb
    für online. Die Folgen waren genau die gemeldeten Fehler:

    - Mutationen wurden nicht pausiert, sondern ausgeführt, scheiterten und
      landeten im Fehlerzustand. onError rollte die optimistische Änderung
      zurück — der abgehakte Satz sprang zurück und war dauerhaft verloren,
      weil nichts in der Warteschlange lag.
    - Abfragen liefen ins Leere statt den Cache zu behalten.

    Deshalb wird hier nicht geraten, sondern gemessen: ein echter Aufruf an
    den Health-Endpunkt von Supabase. Jede HTTP-Antwort (auch 401/404)
    beweist Erreichbarkeit — nur ein geworfener Fehler bedeutet "kein Netz".
    navigator.onLine wird nur noch als schneller Negativ-Hinweis benutzt:
    meldet es false, stimmt das erfahrungsgemäß immer. */

const url = import.meta.env.VITE_SUPABASE_URL

/** Kurz genug, dass die App bei totem Netz nicht hängt, lang genug für
    langsames Mobilfunknetz. */
const PRUEF_TIMEOUT = 5000

/** Offline häufiger nachfassen, damit die Warteschlange zügig losläuft,
    sobald im Studio wieder Empfang da ist. Online reicht ein seltener
    Kontrollblick — der eigentliche Netzverlust wird ohnehin sofort über
    netzfehlerMelden() aus der fehlgeschlagenen Mutation gemeldet. */
const INTERVALL_OFFLINE = 10_000
const INTERVALL_ONLINE = 60_000

async function serverErreichbar(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const abbruch = new AbortController()
    const uhr = setTimeout(() => abbruch.abort(), PRUEF_TIMEOUT)
    try {
      await fetch(`${url}/auth/v1/health`, { method: 'GET', cache: 'no-store', signal: abbruch.signal })
      return true
    } finally {
      clearTimeout(uhr)
    }
  } catch {
    return false
  }
}

/** Erkennt den typischen "kein Netz"-Fehler eines fetch-Aufrufs. Supabase
    reicht den TypeError von fetch durch; die Formulierung unterscheidet
    sich je nach Browser, deshalb zusätzlich der Textabgleich. */
export function istNetzfehler(fehler: unknown): boolean {
  if (fehler instanceof TypeError) return true
  const text = fehler instanceof Error ? fehler.message : String(fehler ?? '')
  return /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|err_name_not_resolved/i.test(text)
}

/** Aus einer gescheiterten Mutation heraus aufgerufen: schaltet sofort auf
    "offline", ohne den nächsten Messtakt abzuwarten. Erst dadurch pausiert
    TanStack Query den Wiederholungsversuch, statt die Mutation als Fehler
    zu verwerfen — genau das rettet den Eintrag in die Warteschlange. */
export function netzfehlerMelden() {
  onlineManager.setOnline(false)
}

/** Reaktiver Netzzustand für die Oberfläche — dieselbe Quelle, an der sich
    auch die Warteschlange orientiert, damit Anzeige und Verhalten nie
    auseinanderlaufen. */
export function useIstOnline(): boolean {
  return useSyncExternalStore(
    (melde: () => void) => onlineManager.subscribe(melde),
    () => onlineManager.isOnline(),
    () => true,
  )
}

/** Einmalig vor dem ersten Rendern aufrufen (siehe main.tsx). */
export function registriereNetzErkennung() {
  onlineManager.setEventListener(setOnline => {
    let beendet = false
    let uhr: ReturnType<typeof setTimeout> | undefined

    const messen = async () => {
      if (beendet) return
      const erreichbar = await serverErreichbar()
      if (beendet) return
      setOnline(erreichbar)
      uhr = setTimeout(() => void messen(), erreichbar ? INTERVALL_ONLINE : INTERVALL_OFFLINE)
    }

    const sofortMessen = () => {
      clearTimeout(uhr)
      void messen()
    }

    // Die Browser-Ereignisse bleiben als schneller Auslöser nützlich, auch
    // wenn ihr Zustand allein nicht zu trauen ist — sie stoßen nur eine
    // echte Messung an.
    window.addEventListener('online', sofortMessen)
    window.addEventListener('offline', sofortMessen)
    void messen()

    return () => {
      beendet = true
      clearTimeout(uhr)
      window.removeEventListener('online', sofortMessen)
      window.removeEventListener('offline', sofortMessen)
    }
  })
}
