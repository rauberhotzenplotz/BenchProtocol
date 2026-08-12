import type { DayWithExercises } from '../training/queries'
import { tagFortschritt, tonnageOf, type TagFortschritt } from '../training/calc'
import type { LoggedSet, TrainingSession } from '../../types/db'

export function naechsterTag(days: DayWithExercises[], setsByExercise: Map<string, LoggedSet[]>) {
  return days.find(d => !tagFortschritt(d.exercises, setsByExercise).fertig) ?? days[0] ?? null
}

export interface FrequenzDaten {
  letzte7: number
  gesamt: number
}
/** Übersprungene Einheiten (status: 'skipped') zählen nicht als Training. */
export function frequenzDaten(sessions: TrainingSession[]): FrequenzDaten {
  const echte = sessions.filter(s => s.status === 'completed')
  const jetzt = Date.now()
  return {
    letzte7: echte.filter(s => jetzt - new Date(s.started_at).getTime() <= 7 * 864e5).length,
    gesamt: echte.length,
  }
}

export function trainingszeitDaten(sessions: TrainingSession[]) {
  const echte = sessions.filter(s => s.status === 'completed')
  const jetzt = Date.now()
  return {
    woche: echte.filter(s => jetzt - new Date(s.started_at).getTime() <= 7 * 864e5).reduce((a, s) => a + (s.minutes ?? 0), 0),
    gesamt: echte.reduce((a, s) => a + (s.minutes ?? 0), 0),
  }
}

export function dayTonnageFromSets(exerciseIds: string[], sets: LoggedSet[]) {
  return tonnageOf(sets.filter(s => exerciseIds.includes(s.exercise_id)))
}

export type { TagFortschritt }
