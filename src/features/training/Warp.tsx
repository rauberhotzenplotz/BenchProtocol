import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cssVars } from '../../lib/style'

const DAUER = 620

/** Streuwert zwischen 0 und 1, allein aus dem Index — gleiche Strahlen
    bei jedem Aufruf, aber ohne erkennbare Regelmäßigkeit. Ein echtes
    Math.random() bräuchte hier nichts zu leisten und würde nur dafür
    sorgen, dass sich ein misslungener Sprung nicht nachstellen lässt. */
function streu(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Der Goldwinkel (137,5°) verteilt die Strahlen rundum, ohne dass sich
    Speichen gegenüberstehen; der Zuschlag aus streu() nimmt ihm die
    letzte Regelmäßigkeit.

    Entscheidend für den Eindruck ist der Startabstand: starten alle
    Strahlen auf demselben Radius, bleibt in der Mitte ein hohler Ring
    stehen und das Ganze sieht aus wie ein Sonnensymbol. Erst
    unterschiedliche Startpunkte, Längen und Helligkeiten erzeugen die
    Tiefe, die den Sprung nach Vorbeiflug aussehen lässt. */
const STRAHLEN = Array.from({ length: 30 }, (_, i) => ({
  winkel: (i * 137.5 + streu(i) * 30) % 360,
  start: 1 + streu(i + 100) * 17,
  weite: 46 + streu(i + 200) * 42,
  dehnung: 2.2 + streu(i + 300) * 3.6,
  spaet: Math.round(streu(i + 400) * 170),
  helligkeit: 0.4 + streu(i + 500) * 0.6,
}))

/** Warp-Sprung beim Betreten des Gym-Modus: die Sterne strecken sich zu
    Linien und rauschen nach außen, dahinter steht die Trainingskonsole.

    Wie die Satzquittung per Portal am body statt im Gym-Modus — der
    Sprung liegt über dessen Vollbild, nicht darin. Er blockiert nichts:
    der Gym-Modus ist von der ersten Millisekunde an bedienbar, der Warp
    räumt sich nur selbst wieder ab. */
export function Warp({ onEnde }: { onEnde: () => void }) {
  useEffect(() => {
    const uhr = setTimeout(onEnde, DAUER)
    return () => clearTimeout(uhr)
  }, [onEnde])

  return createPortal(
    <div className="warp" aria-hidden="true">
      <span className="warp-kern" />
      {STRAHLEN.map((s, i) => (
        <span
          key={i}
          className="warp-strahl"
          style={cssVars({
            '--wa': `${s.winkel.toFixed(1)}deg`,
            '--ws': `${s.start.toFixed(1)}vmax`,
            '--ww': `${s.weite.toFixed(1)}vmax`,
            '--wx': s.dehnung.toFixed(2),
            '--wo': s.helligkeit.toFixed(2),
            animationDelay: `${s.spaet}ms`,
          })}
        />
      ))}
    </div>,
    document.body,
  )
}
