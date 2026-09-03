import type { BenchProgressionRow, Exercise, LoggedSet, Plan } from '../../types/db'
import { geschaetztes1RM } from '../rpeblock/e1rm'
import { topSatzDerWoche, blockAuswertung, empfehlung, type WochenEintrag } from '../rpeblock/blockAuswertung'

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

/** Geschätztes 1RM aus den Ausgangsdaten eines Bankfokus-Plans. Ist ein
    Testsatz mit RPE hinterlegt (plan.rpe), kommt die genauere RPE-Tabelle
    zum Einsatz (siehe rpeblock/e1rm.ts) — sonst Epley-Fallback für Pläne,
    die ihre Ausgangsdaten noch vor der Umstellung eingetragen haben. */
export function baseE1RM(plan: Plan): number {
  const work = plan.work ?? 0
  const reps = plan.reps ?? 0
  if (plan.rpe != null && work > 0 && reps > 0) {
    const wert = geschaetztes1RM(work, reps, plan.rpe)
    if (wert != null) return round(wert, 1)
  }
  const rir = plan.rir ?? 0
  return round(work * (1 + (reps + rir) / 30), 1)
}

export function benchLoad(plan: Plan, row: BenchProgressionRow): number {
  const plate = plan.plate ?? 2.5
  return mround(baseE1RM(plan) * (row.pct ?? 0), plate)
}

/** Ziel-RPE je Woche, wie in den Progressions-Hinweisen aus
    bench/queries.ts (DEFAULT_ROWS) beschrieben — dort nur als Text
    ("RPE 7", "RPE 8–9" …) hinterlegt, hier als Zahl für die
    Drift-Berechnung. */
const GEPLANTE_RPE: Record<number, number> = { 1: 7, 2: 8, 3: 8.5 }

export interface BlockErgebnis {
  /** null = keine "Bank schwer"-Übung oder keine auswertbaren Daten —
      das bisherige 1RM des Plans bleibt unangetastet. */
  neuesE1rm: number | null
  begruendung: string
}

/** Automatische Blockprogression aus den tatsächlich geloggten Wochen 1–3
    der "Bank schwer"-Übung (Top-Satz je Woche, RPE-Tabelle) — ersetzt die
    frühere feste 0/2,5/5-kg-Sprung-Heuristik. PROGRESS/ADD_STIMULUS
    übernehmen das gemessene Bestwert-1RM; bei REDUCE_FATIGUE (RPE-Drift
    zu hoch) oder INSUFFICIENT_DATA (nicht alle drei Wochen sauber
    geloggt) bleibt das 1RM beim Blockstart stehen, kein Sprung ins Blaue. */
export function naechstesE1rm(
  exercises: Exercise[],
  wochenSaetze: LoggedSet[],
  /** Laufende Wochenzahl der ersten Woche dieses Blocks. Seit Wochen
      durchgehend zählen (siehe blockWoche in training/calc.ts) ist das
      nicht mehr zwangsläufig 1: Block 3 beginnt bei Woche 9. Die
      Auswertung selbst rechnet weiter in Blockwochen 1–3. */
  blockStartWoche = 1,
): BlockErgebnis {
  const bankUebung = exercises.find(ex => ex.bench_slot === 'd1')
  if (!bankUebung) {
    return { neuesE1rm: null, begruendung: 'Keine als „Bank schwer“ markierte Übung im Plan gefunden — Ausgangsgewicht bleibt unverändert.' }
  }

  const wochen: WochenEintrag[] = [1, 2, 3].map(woche => ({
    woche,
    topSatz: topSatzDerWoche(
      wochenSaetze
        .filter(s => s.exercise_id === bankUebung.id && s.week === blockStartWoche + woche - 1)
        .map(s => ({ gewicht: s.kg ?? 0, wdh: s.reps ?? 0, rpe: s.rpe })),
    ),
    geplanterRpe: GEPLANTE_RPE[woche] ?? null,
  }))

  const auswertung = blockAuswertung(wochen)
  const empf = empfehlung(auswertung)

  if (empf.typ === 'PROGRESS' || empf.typ === 'ADD_STIMULUS') {
    return { neuesE1rm: auswertung.blockBestE1RM, begruendung: empf.begruendung }
  }
  return { neuesE1rm: auswertung.blockStartE1RM, begruendung: empf.begruendung }
}
