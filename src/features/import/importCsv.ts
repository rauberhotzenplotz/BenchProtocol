import type { CsvWorkout } from './csvParse'
import { matchExercises } from './csvMatch'
import type { Exercise } from '../../types/db'
import type { DayWithExercises } from '../training/queries'

interface GeplanterSatz {
  exercise_id: string
  week: number
  position: number
  kg: number
  reps: number
  done: true
}

export interface CsvImportPlan {
  einheiten: number
  saetze: GeplanterSatz[]
  unmatchedNamen: string[]
}

/** Ordnet CSV-Einheiten den Plan-Übungen zu, ohne zu schreiben — Grundlage
    für die Vorschau. Trägt der Titel einer Einheit "Tag N" ein, wird nur
    gegen die Übungen dieses Tages verglichen (genauer); sonst gegen alle
    Übungen des Plans. Fehlt "Woche N" im Titel, greift die übergebene
    Fallback-Woche (die aktuell aktive). */
export function planCsvImport(workouts: CsvWorkout[], days: DayWithExercises[], fallbackWoche: number): CsvImportPlan {
  const saetze: GeplanterSatz[] = []
  const unmatchedNamen = new Set<string>()

  for (const w of workouts) {
    const zielTag = w.day != null ? days[w.day - 1] : undefined
    const pool: Exercise[] = zielTag ? zielTag.exercises : days.flatMap(d => d.exercises)
    if (!pool.length) {
      w.exercises.forEach(ex => unmatchedNamen.add(ex.name))
      continue
    }

    const woche = w.week ?? fallbackWoche
    const { treffer, unmatched } = matchExercises(w.exercises, pool, ex => ex.name)

    treffer.forEach(t => {
      const csvEx = w.exercises[t.csvIndex]
      csvEx.sets.forEach((set, i) => {
        saetze.push({ exercise_id: t.ziel.id, week: woche, position: i, kg: set.kg, reps: set.reps, done: true })
      })
    })
    unmatched.forEach(i => unmatchedNamen.add(w.exercises[i].name))
  }

  return { einheiten: workouts.length, saetze, unmatchedNamen: [...unmatchedNamen] }
}

