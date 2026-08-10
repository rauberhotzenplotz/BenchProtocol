import { useRegisterSW } from 'virtual:pwa-register/react'

/** Zeigt den vorhandenen ".upd"-Knopf aus der alten App, sobald der
    Service Worker eine neue Fassung im Hintergrund fertig geladen hat. */
export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <button className="upd" onClick={() => void updateServiceWorker(true)}>
      <span className="pt" />
      Update verfügbar — neu laden
    </button>
  )
}
