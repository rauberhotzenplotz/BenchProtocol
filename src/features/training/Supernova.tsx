import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cssVars } from '../../lib/style'

const DAUER = 1900

/** Auswurfstrahlen der Explosion — ungleich lang und ungleich schnell,
    damit die Hülle zerfranst statt als sauberer Kreis aufzugehen. */
const AUSWURF = Array.from({ length: 16 }, (_, i) => {
  const x = Math.sin(i * 78.233) * 43758.5453
  const z = x - Math.floor(x)
  return { winkel: (i * 137.5 + z * 24) % 360, weite: 30 + z * 26, spaet: Math.round(z * 150) }
})

/**
 * Supernova: die größte Rückmeldung, die die App kennt — sie kommt nur,
 * wenn ein Satz die bisherige Bestleistung dieser Übung schlägt (siehe
 * rekord.ts). Deshalb darf sie deutlich länger und lauter sein als die
 * Satzquittung; sie soll sich nach Ereignis anfühlen, nicht nach
 * Bestätigung.
 *
 * Wie die Satzquittung per Portal am body und ohne Klickfang: der
 * Gym-Modus wechselt direkt nach dem Abhaken auf Pause oder Abschluss,
 * und die Nova soll darüber weiterlaufen statt mit dem alten Bildschirm
 * zu verschwinden.
 */
export function Supernova({ text, onEnde }: { text: string; onEnde: () => void }) {
  useEffect(() => {
    const uhr = setTimeout(onEnde, DAUER)
    return () => clearTimeout(uhr)
  }, [onEnde])

  return createPortal(
    <div className="nova" aria-hidden="true">
      <span className="nova-blitz" />
      <span className="nova-huelle" />
      <span className="nova-huelle spaet" />
      {AUSWURF.map((a, i) => (
        <span
          key={i}
          className="nova-strahl"
          style={cssVars({ '--na': `${a.winkel.toFixed(1)}deg`, '--nw': `${a.weite.toFixed(1)}vmax`, animationDelay: `${a.spaet}ms` })}
        />
      ))}
      <div className="nova-text">
        <b>Bestleistung</b>
        <span>{text}</span>
      </div>
    </div>,
    document.body,
  )
}
