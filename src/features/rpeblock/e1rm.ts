import { RPE_TABELLE } from './rpeTabelle'

const RPE_TOLERANZ = 0.001

/** Prozentsatz des 1RM für ein (Wdh, RPE)-Paar — nur exakte Tabellenwerte,
    keine Interpolation zwischen Zeilen/Spalten. null außerhalb der Tabelle
    (Wdh > 8 oder RPE < 6), nie ein Fehler. */
export function prozentsatz(wdh: number, rpe: number): number | null {
  const eintrag = RPE_TABELLE.find(e => e.wdh === wdh && Math.abs(e.rpe - rpe) < RPE_TOLERANZ)
  return eintrag ? eintrag.prozent / 100 : null
}

/** Geschätztes 1RM aus einem geloggten Satz (Gewicht, Wiederholungen, RPE).
    null, wenn außerhalb der Tabelle oder das Gewicht nicht plausibel ist. */
export function geschaetztes1RM(gewicht: number, wdh: number, rpe: number): number | null {
  if (!(gewicht > 0)) return null
  const p = prozentsatz(wdh, rpe)
  return p == null ? null : gewicht / p
}

/** Zielgewicht für einen geplanten (Wdh, RPE) aus einem bekannten 1RM,
    auf die Hantelinkrementierung abgerundet (nie über der Vorgabe). */
export function zielgewicht(e1rm: number, wdh: number, rpe: number, inkrement = 2.5): number | null {
  if (!(e1rm > 0) || !(inkrement > 0)) return null
  const p = prozentsatz(wdh, rpe)
  if (p == null) return null
  return Math.floor((e1rm * p) / inkrement) * inkrement
}
