import type { BenchProgressionRow, Plan } from '../../types/db'

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
