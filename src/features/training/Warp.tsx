import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cssVars } from '../../lib/style'
import { vibrieren, WARP_SPRUNG } from '../../lib/haptik'

/** Muss zur Gesamtlänge der Keyframes in global.css passen (.82s Animation
    plus höchstens 80 ms Verzögerung je Strahl). Erst danach meldet der
    Sprung sich fertig — der Gym-Modus öffnet sich genau dann. */
const DAUER = 900

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
const STRAHLEN = Array.from({ length: 44 }, (_, i) => ({
  winkel: (i * 137.5 + streu(i) * 30) % 360,
  start: 1 + streu(i + 100) * 15,
  weite: 52 + streu(i + 200) * 48,
  dehnung: 2.6 + streu(i + 300) * 4.2,
  spaet: Math.round(streu(i + 400) * 80),
  helligkeit: 0.5 + streu(i + 500) * 0.5,
}))

/** Warp-Sprung beim Betreten des Gym-Modus: der Bildschirm dunkelt ab, ein
    Ring zieht sich auf einen Punkt zusammen, der Punkt zündet, und die
    Sterne strecken sich zu Linien, die nach außen rauschen.
    Erst danach steht die Trainingskonsole.

    Der Sprung liegt bewusst *vor* dem Gym-Modus, nicht darüber: er läuft
    ab, während die Einheit noch zu sehen wäre, deckt sie ab und gibt am
    Ende den fertig aufgebauten Gym-Modus frei (siehe SessionView, das den
    Sprung startet und den Gym-Modus erst in warpFertig einhängt).

    Per Portal am body, weil die umgebende <section> der Einheit eine
    transform-Animation trägt — ein animiertes Elternelement wird für
    position:fixed-Nachfahren zum Containing Block, der Sprung säße sonst
    in der Section statt über dem Bildschirm. */
export function Warp({ onEnde }: { onEnde: () => void }) {
  useEffect(() => {
    vibrieren(WARP_SPRUNG)
    const uhr = setTimeout(onEnde, DAUER)
    return () => clearTimeout(uhr)
  }, [onEnde])

  return createPortal(
    <div className="warp" aria-hidden="true">
      <span className="warp-grund" />
      <span className="warp-ladung" />
      <span className="warp-kern" />
      <span className="warp-welle" />
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
