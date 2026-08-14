import type { LoggedSet } from '../../types/db'
import { e1rm } from '../bench/calc'

/** Bestes geschätztes 1RM, das für diese Übung bisher geloggt wurde.
    0, wenn es noch keinen verwertbaren Satz gibt.

    Gewertet wird über das geschätzte 1RM statt über das reine Gewicht:
    120 kg × 3 sind mehr wert als 125 kg × 1, und wer die Wiederholungen
    steigert statt die Scheiben, hat genauso einen Fortschritt gemacht. */
export function bestesE1rm(sets: LoggedSet[], exerciseId: string): number {
  let best = 0
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue
    if (!s.done || !s.kg || !s.reps) continue
    const wert = e1rm(s.kg, s.reps)
    if (wert > best) best = wert
  }
  return best
}

/** Mindestvorsprung in kg, damit ein Satz als Rekord zählt. Ohne diese
    Schwelle löste schon ein Rundungsrest von 0,05 kg eine Supernova aus,
    und ein Ereignis, das bei jedem zweiten Satz kommt, ist keins mehr. */
const SCHWELLE = 0.5

/** Setzt dieser Satz einen neuen Bestwert für die Übung?

    `frueher` muss die bisherigen Sätze ohne den neuen enthalten — der
    Aufruf erfolgt vor dem Speichern, damit sich der Satz nicht selbst
    schlägt. Ist noch gar nichts geloggt, gilt der erste Satz nicht als
    Rekord: gegen nichts anzutreten ist kein Sieg, und gleich beim ersten
    Satz einer neuen Übung loszufeuern wirkt beliebig. */
export function istRekord(
  kg: number | null | undefined,
  reps: number | null | undefined,
  frueher: LoggedSet[],
  exerciseId: string,
): boolean {
  if (!kg || !reps) return false
  const bisher = bestesE1rm(frueher, exerciseId)
  if (bisher <= 0) return false
  return e1rm(kg, reps) >= bisher + SCHWELLE
}
