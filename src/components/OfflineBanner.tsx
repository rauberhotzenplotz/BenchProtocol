import { useOfflineQueueStatus } from '../lib/offline/queueStatus'

/** Zeigt an, wenn Trainings-Änderungen (Satz, Einheit start/end/skip) wegen
    fehlendem Netz lokal gepuffert sind bzw. gerade nachgeholt werden.
    Strukturell wie UpdateBanner — gleiches .upd/.pt-Muster, andere Farbe. */
export function OfflineBanner() {
  const { wartend, laufend } = useOfflineQueueStatus()
  const gesamt = wartend + laufend
  if (gesamt === 0) return null

  const text =
    wartend > 0
      ? `Offline — ${wartend} Änderung${wartend === 1 ? '' : 'en'} werden synchronisiert, sobald du wieder online bist.`
      : `Synchronisiert … ${laufend} Änderung${laufend === 1 ? '' : 'en'}`

  return (
    <div className="upd offline">
      <span className="pt" />
      {text}
    </div>
  )
}
