import { formatGewicht } from '../../lib/zahlen'

/** Scheiben, wie sie in einem gewöhnlichen Studio liegen, schwerste zuerst. */
export const STANDARD_SCHEIBEN = [25, 20, 15, 10, 5, 2.5, 1.25] as const

/** Stangen zur Auswahl: Langhantel, Damen-/Technikstange, SZ-Stange. */
export const STANGEN = [20, 15, 10] as const

export interface Beladung {
  stange: number
  /** Scheiben auf einer Seite, schwerste zuerst. */
  jeSeite: number[]
  /** Was sich mit den vorhandenen Scheiben nicht auflegen lässt, für
      beide Seiten zusammen — 0, wenn das Gewicht genau aufgeht. */
  rest: number
}

/** Welche Scheiben je Seite auf die Stange gehören, damit das Zielgewicht
    herauskommt. Gierig von der schwersten Scheibe an — mit den üblichen
    Scheibensätzen ist das zugleich die Lösung mit den wenigsten Scheiben.

    Gerechnet wird in Gramm als ganze Zahlen: In Kilo ergäbe etwa
    (61,25 − 20) / 2 nach mehreren Abzügen gern 0,6249999 statt 0,625, und
    die letzte 1,25er-Scheibe fiele dann still weg.

    null unterhalb des Stangengewichts — da gibt es nichts aufzulegen,
    das Gewicht ist mit dieser Stange schlicht nicht erreichbar. */
export function beladung(zielKg: number, stange: number = STANGEN[0], scheiben: readonly number[] = STANDARD_SCHEIBEN): Beladung | null {
  const g = (kg: number) => Math.round(kg * 1000)
  if (!(zielKg >= stange)) return null

  let seite = Math.floor((g(zielKg) - g(stange)) / 2)
  const jeSeite: number[] = []
  for (const scheibe of [...scheiben].sort((a, b) => b - a)) {
    while (seite >= g(scheibe)) {
      jeSeite.push(scheibe)
      seite -= g(scheibe)
    }
  }
  const aufgelegt = g(stange) + 2 * jeSeite.reduce((a, s) => a + g(s), 0)
  return { stange, jeSeite, rest: (g(zielKg) - aufgelegt) / 1000 }
}

/** "25 · 5 · 1,25" — Scheiben einer Seite, für die Anzeige. Gleiche
    Scheiben hintereinander werden zusammengefasst: "2 × 20 · 5" liest
    sich im Studio schneller als "20 · 20 · 5". */
export function beladungText(b: Beladung): string {
  if (!b.jeSeite.length) return 'nur Stange'
  const teile: string[] = []
  for (let i = 0; i < b.jeSeite.length; ) {
    let n = 1
    while (b.jeSeite[i + n] === b.jeSeite[i]) n++
    teile.push(n > 1 ? `${n} × ${formatGewicht(b.jeSeite[i])}` : formatGewicht(b.jeSeite[i]))
    i += n
  }
  return teile.join(' · ')
}

const STANGE_KEY = 'benchProtocol.stange'

/** Gewählte Stange — eine Geräteeinstellung wie die automatische Pause
    (siehe pause.ts), kein Teil des Plans. */
export function gewaehlteStange(): number {
  const n = Number(localStorage.getItem(STANGE_KEY))
  return (STANGEN as readonly number[]).includes(n) ? n : STANGEN[0]
}

export function setGewaehlteStange(kg: number) {
  localStorage.setItem(STANGE_KEY, String(kg))
}
