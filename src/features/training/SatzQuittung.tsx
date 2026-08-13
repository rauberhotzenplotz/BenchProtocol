import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cssVars } from '../../lib/style'

const DAUER = 780

/** Funken rundherum — leicht ungleichmäßig verteilt und unterschiedlich
    weit, sonst sieht der Ausbruch wie ein gezirkeltes Rad aus. */
const FUNKEN = [
  { winkel: -75, weite: 78, spaet: 0 },
  { winkel: -30, weite: 92, spaet: 40 },
  { winkel: 12, weite: 70, spaet: 15 },
  { winkel: 55, weite: 88, spaet: 60 },
  { winkel: 104, weite: 74, spaet: 25 },
  { winkel: 150, weite: 90, spaet: 50 },
  { winkel: -160, weite: 80, spaet: 10 },
  { winkel: -118, weite: 96, spaet: 70 },
]

/** Kurze Bestätigung beim Abhaken eines Satzes: Schockwelle, Haken der
    sich zeichnet, Funken. Hängt per Portal am body statt im Gym-Modus —
    direkt nach dem Abhaken wechselt der Gym-Modus je nach Lage auf den
    Pausen- oder Abschlussbildschirm, und die Quittung soll darüber
    weiterlaufen, statt mit dem alten Bildschirm zu verschwinden. */
export function SatzQuittung({ onEnde }: { onEnde: () => void }) {
  useEffect(() => {
    const uhr = setTimeout(onEnde, DAUER)
    return () => clearTimeout(uhr)
  }, [onEnde])

  return createPortal(
    <div className="satzok" aria-hidden="true">
      <div className="satzok-kern">
        <span className="satzok-welle" />
        <span className="satzok-welle spaet" />
        <svg className="satzok-haken" viewBox="0 0 100 100">
          <path d="M30 51 L44 65 L71 34" />
        </svg>
        {FUNKEN.map((f, i) => {
          const rad = (f.winkel * Math.PI) / 180
          return (
            <span
              key={i}
              className="satzok-funke"
              style={cssVars({
                '--fx': `${(Math.cos(rad) * f.weite).toFixed(1)}px`,
                '--fy': `${(Math.sin(rad) * f.weite).toFixed(1)}px`,
                animationDelay: `${f.spaet}ms`,
              })}
            />
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
