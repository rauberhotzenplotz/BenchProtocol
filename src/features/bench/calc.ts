import type { BenchProgressionRow, Exercise, LoggedSet, Plan } from '../../types/db'
import { setsOf } from '../training/calc'

/** Epley — identisch zur Formel aus der alten App. */
export function e1rm(kg: number, reps: number): number {
  return kg * (1 + reps / 30)
}

export function brzycki(kg: number, reps: number): number {
  return reps >= 37 ? 0 : (kg * 36) / (37 - reps)
}

export function mround(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function round(n: number, d = 1): number {
  return Math.round(n * 10 ** d) / 10 ** d
}

/** Geschätztes 1RM aus den Ausgangsdaten eines Bankfokus-Plans. */
export function baseE1RM(plan: Plan): number {
  const work = plan.work ?? 0
  const reps = plan.reps ?? 0
  const rir = plan.rir ?? 0
  return round(work * (1 + (reps + rir) / 30), 1)
}

export function benchLoad(plan: Plan, row: BenchProgressionRow): number {
  const plate = plan.plate ?? 2.5
  return mround(baseE1RM(plan) * (row.pct ?? 0), plate)
}

export interface BlockSchritt {
  delta: number
  begruendung: string
}

/** Wie viel das Arbeitsgewicht beim Blockabschluss steigt — abgeleitet aus
    den tatsächlich geloggten Sätzen von Woche 3, nicht aus einem festen
    Schritt: nicht alle Sätze geschafft → Gewicht bleibt gleich; planmäßig
    geschafft → 2,5 kg; mit deutlich mehr Reserve geschafft (Ø RPE der
    erledigten Sätze ≤ 6,5, also spürbar unter dem für Woche 3 vorgesehenen
    RPE 8–9) → 5 kg. */
export function blockSchritt(exercises: Exercise[], woche3Saetze: LoggedSet[]): BlockSchritt {
  const bankUebungen = exercises.filter(ex => ex.bench_slot != null)
  if (bankUebungen.length === 0) {
    return { delta: 2.5, begruendung: 'Keine Bankdrücken-Übung mit Woche-3-Daten verknüpft — Standardschritt von 2,5 kg.' }
  }

  const geplant = bankUebungen.reduce((a, ex) => a + setsOf(ex.scheme), 0)
  const uebungIds = new Set(bankUebungen.map(ex => ex.id))
  const relevanteSaetze = woche3Saetze.filter(s => uebungIds.has(s.exercise_id))
  const erledigt = relevanteSaetze.filter(s => s.done).length

  if (geplant > 0 && erledigt < geplant) {
    return {
      delta: 0,
      begruendung: `Woche 3 nicht in allen Sätzen geschafft (${erledigt}/${geplant}) — Ausgangsgewicht bleibt unverändert.`,
    }
  }

  const rpeWerte = relevanteSaetze.filter(s => s.done && s.rpe != null).map(s => s.rpe as number)
  const rpeSchnitt = rpeWerte.length ? rpeWerte.reduce((a, b) => a + b, 0) / rpeWerte.length : null

  if (rpeSchnitt != null && rpeSchnitt <= 6.5) {
    return {
      delta: 5,
      begruendung: `Woche 3 mit deutlich mehr Reserve geschafft (Ø RPE ${round(rpeSchnitt, 1)}) — größerer Sprung von 5 kg.`,
    }
  }

  return { delta: 2.5, begruendung: 'Woche 3 planmäßig geschafft — Standardschritt von 2,5 kg.' }
}
