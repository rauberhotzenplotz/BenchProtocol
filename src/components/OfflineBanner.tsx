import { useOfflineQueueStatus } from '../lib/offline/queueStatus'
import { useIstOnline } from '../lib/offline/netz'

/** Zeigt an, wenn Änderungen wegen fehlendem Netz lokal gepuffert sind bzw.
    gerade nachgeholt werden — und seit der Offline-Überarbeitung auch den
    reinen Zustand "kein Netz" ohne offene Änderungen. Im Studio ist das die
    eigentlich wichtige Auskunft: weitertrainieren ist gefahrlos möglich,
    nichts geht verloren.

    Strukturell wie UpdateBanner — gleiches .upd/.pt-Muster, andere Farbe. */
export function OfflineBanner() {
  const { wartend, laufend } = useOfflineQueueStatus()
  const istOnline = useIstOnline()
  const gesamt = wartend + laufend

  if (gesamt === 0 && istOnline) return null

  const text =
    laufend > 0 && istOnline
      ? `Synchronisiert … ${laufend} Änderung${laufend === 1 ? '' : 'en'}`
      : gesamt > 0
        ? gesamt === 1
          ? 'Offline — 1 Änderung wird synchronisiert, sobald du wieder online bist.'
          : `Offline — ${gesamt} Änderungen werden synchronisiert, sobald du wieder online bist.`
        : 'Offline — alles bleibt nutzbar, Änderungen werden später synchronisiert.'

  return (
    <div className="upd offline">
      <span className="pt" />
      {text}
    </div>
  )
}
