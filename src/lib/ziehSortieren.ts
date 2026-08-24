import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { vibrieren, AUFGENOMMEN } from './haptik'

/** Wie lange gedrückt gehalten werden muss, bis eine Übung an der Hand
    klebt. Kurz genug, dass es nicht wie Warten wirkt, lang genug, dass
    ein Antippen oder ein beginnendes Scrollen nicht versehentlich zum
    Ziehen wird. */
const LANGDRUCK_MS = 420

/** Wandert der Finger vor Ablauf des Langdrucks weiter als das, war es
    kein Aufnehmen, sondern ein Scrollen — dann lassen wir die Liste in
    Ruhe. */
const WACKEL_PX = 10

export type ZiehAchse = 'x' | 'y'

export type ZiehZustand = {
  /** Achse, entlang der gezogen wird — steckt mit im Zustand, damit
      ziehStil() unten ohne weitere Angabe auskommt. */
  achse: ZiehAchse
  /** Ursprünglicher Platz des aufgenommenen Eintrags. */
  von: number
  /** Platz, an dem er bei jetzigem Loslassen landen würde. */
  nach: number
  /** Größe eines Platzes samt Abstand — so weit weichen die anderen aus. */
  schritt: number
  /** Fingerweg seit dem Aufnehmen, entlang der Achse. */
  versatz: number
}

/** Wohin ein Eintrag während des Ziehens verschoben dargestellt wird.

    Bewusst eine reine Funktion neben dem Hook statt einer Funktion aus
    seinem Rückgabewert: Eine aus einem Hook gereichte Funktion beim
    Rendern zu rufen wertet der React-Compiler als möglichen Ref-Zugriff
    während des Renderns. So ist es nebenbei ohne DOM prüfbar. */
export function ziehStil(zustand: ZiehZustand | null, index: number): CSSProperties {
  if (!zustand) return {}
  const { achse, von, nach, schritt, versatz } = zustand
  const schieben = (px: number) => (achse === 'y' ? `translateY(${px}px)` : `translateX(${px}px)`)
  if (index === von) {
    return {
      transform: `${schieben(versatz)} scale(1.04)`,
      zIndex: 5,
      position: 'relative',
      transition: 'none',
      // Der aufgenommene Eintrag soll die Treffererkennung nicht stören;
      // gezogen wird ohnehin über Zuhörer am Fenster.
      pointerEvents: 'none',
    }
  }
  // Die Einträge zwischen altem und neuem Platz weichen um genau einen
  // Platz aus — so entsteht die Lücke, in die abgelegt wird.
  let weg = 0
  if (nach > von && index > von && index <= nach) weg = -schritt
  else if (nach < von && index >= nach && index < von) weg = schritt
  return {
    transform: weg ? schieben(weg) : undefined,
    transition: 'transform .18s cubic-bezier(.22,1,.36,1)',
  }
}

/** Umsortieren per Aufnehmen und Ziehen, für Finger gebaut.

    Bewusst ohne Fremdbibliothek: Gebraucht wird eine einzige Geste auf
    kurzen Listen, und die üblichen Pakete bringen Maus-, Tastatur- und
    Mehrfachauswahl-Apparat mit, den hier nichts nutzt.

    Zwei Eigenheiten, die den Aufbau erklären:

    1. Die Ereignisse hängen am Fenster, nicht an den Einträgen. Beim
       Ziehen verlässt der Finger den Eintrag ständig, und React ordnet
       die Liste beim Ablegen neu — Zuhörer am Eintrag selbst gingen
       dabei verloren.

    2. Das Scrollen wird über einen eigenen touchmove-Zuhörer mit
       passive:false unterbunden. Reacts onTouchMove ist passiv
       angemeldet, ein preventDefault() darin bliebe wirkungslos, und die
       Liste würde unter dem gezogenen Eintrag wegscrollen. Unterbunden
       wird nur, solange wirklich gezogen wird — sonst ließe sich die
       Seite gar nicht mehr bewegen. */
export function useZiehSortieren({
  behaelter,
  achse,
  onSortieren,
  aus = false,
  griff,
}: {
  /** Das umschließende Element, vom Aufrufer per Callback-Ref gehalten:
      `const [kasten, setKasten] = useState<HTMLDivElement | null>(null)`
      und `<div ref={setKasten}>`.

      Bewusst so herum, statt hier eine Ref anzulegen und nach außen zu
      reichen: Der React-Compiler wertet einen aus einem Hook gereichten
      Anker beim Rendern als Ref-Zugriff während des Renderns. So bleibt
      der Rückgabewert reine Daten. */
  behaelter: HTMLDivElement | null
  achse: ZiehAchse
  /** Wird einmal beim Ablegen gerufen, nur wenn sich der Platz geändert hat. */
  onSortieren: (von: number, nach: number) => void
  /** Schaltet die Geste ab, etwa bei nur einem Eintrag. */
  aus?: boolean
  /** CSS-Wähler des Bereichs, auf dem das Aufnehmen beginnen darf.
      Ohne Angabe zählt der ganze Eintrag. Gebraucht für aufgeklappte
      Übungskarten: Dort soll ein langer Druck auf eine Satzzeile die
      Karte nicht als Ganzes aufnehmen, sondern nur der auf ihrem Kopf. */
  griff?: string
}): {
  /** Was gerade gezogen wird, sonst null. An ziehStil() weiterreichen. */
  zustand: ZiehZustand | null
} {
  const [zustand, setZustand] = useState<ZiehZustand | null>(null)

  // Der Zustand wird auch aus den Fenster-Zuhörern gelesen, die beim
  // Anmelden sonst einen veralteten Stand festhalten würden — deshalb
  // zusätzlich als Ref.
  const zustandRef = useRef<ZiehZustand | null>(null)
  const setzen = useCallback((z: ZiehZustand | null) => {
    zustandRef.current = z
    setZustand(z)
  }, [])

  // Die Zuhörer unten werden einmal angemeldet und würden die Werte
  // dieses Renders festhalten — deshalb liegen sie in Refs. Nachgezogen
  // wird im Effekt, nicht beim Rendern: Ein Render kann verworfen werden,
  // eine dabei gesetzte Ref bliebe trotzdem stehen.
  const ausRef = useRef(aus)
  const sortierenRef = useRef(onSortieren)
  const griffRef = useRef(griff)
  useEffect(() => {
    ausRef.current = aus
    sortierenRef.current = onSortieren
    griffRef.current = griff
  })

  useEffect(() => {
    if (!behaelter) return

    let uhr: ReturnType<typeof setTimeout> | undefined
    let start: { index: number; x: number; y: number } | null = null
    let mitten: number[] = []
    let klickSchlucken = false

    const laengs = (e: PointerEvent) => (achse === 'y' ? e.clientY : e.clientX)

    const eintraege = () =>
      Array.from(behaelter.querySelectorAll<HTMLElement>('[data-zieh]')).sort(
        (a, b) => Number(a.dataset.zieh) - Number(b.dataset.zieh),
      )

    const aufnehmen = (index: number) => {
      const kaesten = eintraege().map(el => el.getBoundingClientRect())
      if (kaesten.length < 2 || !kaesten[index]) return
      mitten = kaesten.map(k => (achse === 'y' ? k.top + k.height / 2 : k.left + k.width / 2))
      const eigen = achse === 'y' ? kaesten[index].height : kaesten[index].width
      // Abstand zwischen zwei Plätzen aus den Kästen ablesen statt raten:
      // Die drei Listen haben verschiedene Abstände.
      const luecke = Math.max(
        0,
        achse === 'y'
          ? kaesten[1].top - (kaesten[0].top + kaesten[0].height)
          : kaesten[1].left - (kaesten[0].left + kaesten[0].width),
      )
      vibrieren(AUFGENOMMEN)
      setzen({ achse, von: index, nach: index, schritt: eigen + luecke, versatz: 0 })
    }

    const abbrechen = () => {
      clearTimeout(uhr)
      start = null
      setzen(null)
    }

    const beiBewegung = (e: PointerEvent) => {
      const z = zustandRef.current
      if (!z) {
        // Noch nicht aufgenommen: Wandert der Finger, war es ein Scrollen.
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > WACKEL_PX) abbrechen()
        return
      }
      if (!start) return
      const versatz = laengs(e) - (achse === 'y' ? start.y : start.x)
      const zentrum = mitten[z.von] + versatz
      let nach = z.von
      for (let i = 0; i < mitten.length; i++) {
        if (i === z.von) continue
        if (i < z.von && zentrum < mitten[i]) nach = Math.min(nach, i)
        if (i > z.von && zentrum > mitten[i]) nach = Math.max(nach, i)
      }
      setzen({ ...z, nach, versatz })
    }

    const beiEnde = () => {
      clearTimeout(uhr)
      const z = zustandRef.current
      if (z) {
        // Nach einem Ziehen folgt beim Loslassen noch ein Klick auf den
        // Eintrag darunter — der würde sonst die Karte auf- oder die
        // Übung umschalten.
        klickSchlucken = true
        setTimeout(() => {
          klickSchlucken = false
        }, 0)
        if (z.nach !== z.von) sortierenRef.current(z.von, z.nach)
      }
      start = null
      setzen(null)
    }

    const beiStart = (e: PointerEvent) => {
      if (ausRef.current || zustandRef.current) return
      // Nur die Haupttaste bzw. ein Finger.
      if (e.button > 0) return
      const ziel = e.target as HTMLElement | null
      // Auf einem Eingabefeld gehört der lange Druck dem Feld: Dort will
      // man Text markieren oder die Einfügemarke setzen, nicht die Übung
      // aufnehmen. Betrifft Schema und Pause im Plan-Editor sowie die
      // Notiz- und Zahlenfelder in der Tagesansicht.
      if (ziel?.closest('input, textarea, select')) return
      if (griffRef.current && !ziel?.closest(griffRef.current)) return
      const el = ziel?.closest<HTMLElement>('[data-zieh]')
      if (!el || !behaelter.contains(el)) return
      const index = Number(el.dataset.zieh)
      if (!Number.isInteger(index)) return
      start = { index, x: e.clientX, y: e.clientY }
      clearTimeout(uhr)
      uhr = setTimeout(() => {
        if (start) aufnehmen(start.index)
      }, LANGDRUCK_MS)
    }

    // Siehe Kopfkommentar, Punkt 2: nur während des Ziehens sperren.
    const scrollenSperren = (e: TouchEvent) => {
      if (zustandRef.current) e.preventDefault()
    }

    const klickAbfangen = (e: MouseEvent) => {
      if (!klickSchlucken) return
      e.stopPropagation()
      e.preventDefault()
    }

    behaelter.addEventListener('pointerdown', beiStart)
    behaelter.addEventListener('click', klickAbfangen, true)
    window.addEventListener('pointermove', beiBewegung)
    window.addEventListener('pointerup', beiEnde)
    window.addEventListener('pointercancel', beiEnde)
    window.addEventListener('touchmove', scrollenSperren, { passive: false })
    return () => {
      clearTimeout(uhr)
      behaelter.removeEventListener('pointerdown', beiStart)
      behaelter.removeEventListener('click', klickAbfangen, true)
      window.removeEventListener('pointermove', beiBewegung)
      window.removeEventListener('pointerup', beiEnde)
      window.removeEventListener('pointercancel', beiEnde)
      window.removeEventListener('touchmove', scrollenSperren)
    }
  }, [behaelter, achse, setzen])

  return { zustand }
}
