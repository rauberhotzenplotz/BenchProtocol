import type { Plan } from '../types/db'
import { blockWoche } from '../features/training/calc'

/** Stimmung des Hintergrundnebels. Bankfokus-Pläne laufen in festen
    Vierwochenblöcken (siehe wochenLabel in features/training/calc.ts):
    Woche 1–2 bauen auf, Woche 3 ist die schwerste, Woche 4 ist Deload.
    Standardpläne zählen unbegrenzt weiter und haben deshalb keine Phase,
    die man ablesen könnte — sie bleiben beim Grundton. */
export type NebelPhase = 'aufbau' | 'schwer' | 'deload'

export function nebelPhase(plan: Plan | null | undefined): NebelPhase {
  if (!plan || plan.typ !== 'bench') return 'aufbau'
  const w = blockWoche(plan.week)
  if (w === 4) return 'deload'
  if (w === 3) return 'schwer'
  return 'aufbau'
}
