import type { EinheitPunkt } from './calc'

export interface Stern {
  /** 0 = älteste, 1 = jüngste Einheit — nach echtem Kalenderabstand. */
  x: number
  /** 0 = oben (viel bewegt), 1 = unten (nichts bewegt). */
  y: number
  /** 0…1, aus den abgehakten Sätzen — steuert den Radius. */
  groesse: number
  punkt: EinheitPunkt
}

/** Wandelt Einheiten in Sternpositionen um.

    Bewusst kein weiteres Messinstrument: für das genaue Ablesen von
    Tonnage und Dauer gibt es im Cockpit bereits zwei Balkendiagramme.
    Das Sternbild zeigt etwas, das dort untergeht — den Rhythmus. Die
    x-Achse folgt deshalb der echten Kalenderzeit statt der bloßen
    Reihenfolge: eine Woche Pause hinterlässt eine sichtbare Lücke
    zwischen den Sternen, mehrere Einheiten in Folge rücken zusammen.

    Die y-Achse misst gegen 0, nicht gegen die kleinste Einheit des
    Zeitraums. Gegen das Minimum normiert sähen drei fast gleich schwere
    Einheiten aus wie ein Zickzack aus Hoch und Tief; gegen 0 liegen sie
    als ruhige Kette nebeneinander — was der Wahrheit entspricht. */
export function sternbild(punkte: EinheitPunkt[]): Stern[] {
  if (punkte.length === 0) return []

  const zeiten = punkte.map(p => p.zeit)
  const t0 = Math.min(...zeiten)
  const t1 = Math.max(...zeiten)
  const spanne = t1 - t0

  const maxTonnage = Math.max(...punkte.map(p => p.tonnage))
  const maxSaetze = Math.max(...punkte.map(p => p.erledigt))

  return punkte.map(p => ({
    // Fällt alles auf denselben Zeitpunkt (oder gibt es nur eine
    // Einheit), steht der Stern mittig statt am linken Rand.
    x: spanne > 0 ? (p.zeit - t0) / spanne : 0.5,
    y: maxTonnage > 0 ? 1 - p.tonnage / maxTonnage : 0.5,
    groesse: maxSaetze > 0 ? p.erledigt / maxSaetze : 0,
    punkt: p,
  }))
}
