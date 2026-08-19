import type { Exercise, LoggedSet } from '../../types/db'
import { e1rm, round } from '../bench/calc'

export interface Rekord {
  reps: number
  kg: number
  e1: number
  woche: number
}

export interface UebungsGruppe {
  key: string
  name: string
  exerciseIds: string[]
}

/** Fasst Übungen mit derselben Herkunft (exercises.library_id) zu einer
    Bestenliste zusammen — dieselbe Katalog-Übung aus mehreren Plänen zählt
    dadurch als eine Übung, statt pro Plan eine eigene, leere Rekordliste
    zu führen. Übungen ohne Herkunft (frei angelegt, ohne Bibliotheks-
    Picker) bleiben einzeln, wie bisher: eigener Schlüssel über die
    eigene id. */
export function gruppiere(exercises: Exercise[]): UebungsGruppe[] {
  const map = new Map<string, UebungsGruppe>()
  for (const ex of exercises) {
    const key = ex.library_id ?? ex.id
    const bestehend = map.get(key)
    if (bestehend) bestehend.exerciseIds.push(ex.id)
    else map.set(key, { key, name: ex.name, exerciseIds: [ex.id] })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Bester Satz je Wiederholungszahl — über alle exerciseIds einer Gruppe
    hinweg, nicht nur einer einzelnen Übungszeile. */
export function besteRekorde(sets: LoggedSet[], exerciseIds: string[]): Rekord[] {
  if (!exerciseIds.length) return []
  const ids = new Set(exerciseIds)
  const je = new Map<number, Rekord>()
  sets
    .filter(s => ids.has(s.exercise_id) && s.kg && s.reps)
    .forEach(s => {
      const wert = round(e1rm(s.kg!, s.reps!), 1)
      const bisher = je.get(s.reps!)
      if (!bisher || wert > bisher.e1) je.set(s.reps!, { reps: s.reps!, kg: s.kg!, e1: wert, woche: s.week })
    })
  return [...je.values()].sort((a, b) => a.reps - b.reps)
}
