import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cssVars } from '../lib/style'

// Die ganze Choreografie läuft auf halber Zeit (alle Dauern und
// Verzögerungen in .startbild/.sb-* sind entsprechend halbiert). Vorher
// stand die App bei jedem Start gut zwei Sekunden still, bevor sich etwas
// antippen ließ — die größte einzelne Wartezeit, die sie hatte. Der Wert
// hier muss zum spätesten Ende dort passen (sb-funke: .48s Dauer plus bis
// zu .35s Verzögerung), sonst bricht das Bild mitten in der Bewegung ab.
const AUTO_DISMISS = 850
const ENTFERNEN_NACH = 260 // muss zur .24s-CSS-Transition von .startbild passen

/** Funken, die im Moment des Zusammensetzens aus dem Zeichen schießen.
    Ungleichmäßig verteilt und in den drei Akzentfarben, damit es nach
    Streuung aussieht und nicht nach Zahnrad. */
const FUNKEN = [
  { winkel: -84, weite: 96, spaet: 310, ton: 'neon' },
  { winkel: -36, weite: 124, spaet: 330, ton: 'violett' },
  { winkel: 6, weite: 104, spaet: 318, ton: 'neon' },
  { winkel: 44, weite: 132, spaet: 345, ton: 'magenta' },
  { winkel: 92, weite: 100, spaet: 323, ton: 'neon' },
  { winkel: 134, weite: 128, spaet: 350, ton: 'violett' },
  { winkel: 172, weite: 108, spaet: 328, ton: 'neon' },
  { winkel: -140, weite: 136, spaet: 338, ton: 'magenta' },
  { winkel: -108, weite: 92, spaet: 315, ton: 'neon' },
]

/** Schriftzug buchstabenweise: jeder Buchstabe bekommt seinen Platz in der
    Reihe als CSS-Variable, die Verzögerung rechnet das Stylesheet daraus.
    Der Versatz läuft über beide Wörter durch, darum der Startindex. */
function buchstaben(wort: string, ab: number) {
  return [...wort].map((z, i) => (
    <span key={i} style={cssVars({ '--i': ab + i })}>
      {z}
    </span>
  ))
}

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
          <span className="sb-bloom" />
          {FUNKEN.map((f, i) => {
            const rad = (f.winkel * Math.PI) / 180
            return (
              <span
                key={i}
                className={'sb-funke ' + f.ton}
                style={cssVars({
                  '--fx': `${(Math.cos(rad) * f.weite).toFixed(1)}px`,
                  '--fy': `${(Math.sin(rad) * f.weite).toFixed(1)}px`,
                  animationDelay: `${f.spaet}ms`,
                })}
              />
            )
          })}
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
          <b>{buchstaben('Bench', 0)}</b>
          <em>{buchstaben('Protocol', 5)}</em>
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
