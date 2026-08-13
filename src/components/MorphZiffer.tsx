import { useLayoutEffect, useRef } from 'react'
import { besteVariante, formFuer, mische, pfad, type Punkt } from './ziffernform'

/** Länger als nötig gewählt: die Verformung soll fließen, nicht schnappen.
    Muss deutlich unter einer Sekunde bleiben, sonst liefe sie in den
    nächsten Sekundenwechsel hinein. */
const DAUER = 560

/** Nur der App-eigene Schalter, bewusst nicht prefers-reduced-motion des
    Systems: die Oberfläche animiert sonst überall unabhängig davon
    (Startbild, Funken, Ringe, Seitenwechsel), und ein einzelnes Bauteil,
    das als Einziges stillsteht, wirkt kaputt statt rücksichtsvoll. Das
    Stylesheet hält es bei data-motion="off" genauso — dort schaltet die
    Systemeinstellung ebenfalls nichts von sich aus ab. */
function bewegungAn(): boolean {
  return document.documentElement.dataset.motion !== 'off'
}

function weich(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Eine Ziffernstelle, die sich beim Wechsel in die nächste verformt,
    statt zu springen oder auszublenden.

    Der Pfad wird ausschließlich im Effekt gesetzt, nie über JSX: der
    Timer rendert im Sekundentakt neu, auch für Stellen, die sich gar
    nicht ändern. Käme das d-Attribut aus dem Rendern, malte React dabei
    kurz die Zielform, bevor die Animation wieder an den Anfang springt.
    Nebenbei bleibt so jedes Einzelbild ein reiner DOM-Zugriff statt eines
    React-Renders — das hält die Bewegung auch auf dem Handy flüssig. */
export function MorphZiffer({ zeichen }: { zeichen: string }) {
  const pfadRef = useRef<SVGPathElement>(null)
  const standRef = useRef<Punkt[] | null>(null)
  const rafRef = useRef(0)

  useLayoutEffect(() => {
    const setzen = (punkte: Punkt[]) => {
      standRef.current = punkte
      pfadRef.current?.setAttribute('d', pfad(punkte))
    }

    // Beim ersten Aufbau gibt es keine Vorgängerform zum Verformen.
    if (standRef.current == null || !bewegungAn()) {
      setzen(formFuer(zeichen))
      return
    }

    // Vom aktuell gezeichneten Stand aus starten, nicht von der vorigen
    // Zielform — sonst würde ein Wechsel mitten in der Bewegung springen.
    const { start, ziel } = besteVariante(
      standRef.current.map(p => [...p] as Punkt),
      zeichen,
    )

    const t0 = performance.now()
    const schritt = (jetzt: number) => {
      const roh = Math.min(1, (jetzt - t0) / DAUER)
      setzen(mische(start, ziel, weich(roh)))
      if (roh < 1) rafRef.current = requestAnimationFrame(schritt)
    }
    rafRef.current = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(rafRef.current)
  }, [zeichen])

  return (
    <svg className="gym-ziffer" viewBox="0 0 100 160" aria-hidden="true">
      <path ref={pfadRef} />
    </svg>
  )
}

export function MorphDoppelpunkt() {
  return (
    <svg className="gym-doppelpunkt" viewBox="0 0 34 160" aria-hidden="true">
      <circle cx="17" cy="57" r="8" />
      <circle cx="17" cy="113" r="8" />
    </svg>
  )
}
