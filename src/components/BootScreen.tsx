import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const AUTO_DISMISS = 1400
const ENTFERNEN_NACH = 460 // muss zur .44s-CSS-Transition von .startbild passen

/** Läuft einmal beim App-Start (schon angemeldet): die Scheibe zeichnet
    sich, die Hantel schiebt sich auf, der Schriftzug fährt von beiden
    Seiten ein. Ein Klick oder eine Taste bricht ab. Läuft nur einmal,
    weil AppShell (der einzige Aufrufer) über die gesamte SPA-Sitzung
    hinweg nur einmal mountet, nicht bei jeder Routen-Navigation. */
export function BootScreen() {
  const [sichtbar, setSichtbar] = useState(true)
  const [fort, setFort] = useState(false)
  const wegRef = useRef(false)

  const schliessen = () => {
    if (wegRef.current) return
    wegRef.current = true
    setFort(true)
    setTimeout(() => setSichtbar(false), ENTFERNEN_NACH)
  }

  useEffect(() => {
    // Die Taste bricht nur das Startbild ab — App-Kürzel sollen dabei nicht
    // auch noch die Ansicht wechseln, daher capture-Phase + preventDefault.
    const taste = (e: KeyboardEvent) => {
      if (!e.key) return
      e.preventDefault()
      schliessen()
    }
    const uhr = setTimeout(schliessen, AUTO_DISMISS)
    document.addEventListener('keydown', taste, true)
    return () => {
      clearTimeout(uhr)
      document.removeEventListener('keydown', taste, true)
    }
  }, [])

  if (!sichtbar) return null

  return createPortal(
    <div className={'startbild' + (fort ? ' fort' : '')} aria-hidden="true" onClick={schliessen}>
      <div className="sb-kern">
        <div className="sb-scheibe">
          <span className="sb-puls" />
          <span className="sb-puls p2" />
          <svg className="sb-mark" viewBox="0 0 64 64">
            <circle className="rg sb-r1" cx="32" cy="32" r="25" />
            <circle className="rg sb-r2" cx="32" cy="32" r="17" />
            <rect className="sb-bar" x="14" y="30" width="36" height="4" rx="2" />
            <rect className="sb-kl sb-kl-l" x="10" y="25" width="5" height="14" rx="2" />
            <rect className="sb-kl sb-kl-r" x="49" y="25" width="5" height="14" rx="2" />
            <circle className="sb-fk f1" cx="32" cy="7" r="2.4" />
            <circle className="sb-fk f2" cx="57" cy="32" r="1.6" />
            <circle className="sb-fk f3" cx="32" cy="49" r="1.8" />
          </svg>
        </div>
        <div className="sb-wort">
          <b>Bench</b>
          <em>Protocol</em>
        </div>
        <div className="sb-linie">
          <i />
        </div>
        <div className="sb-status">Konsole startet</div>
      </div>
    </div>,
    document.body,
  )
}
