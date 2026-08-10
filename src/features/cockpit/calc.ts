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
export function frequenzDaten(sessions: TrainingSession[]): FrequenzDaten {
  const jetzt = Date.now()
  return {
    letzte7: sessions.filter(s => jetzt - new Date(s.started_at).getTime() <= 7 * 864e5).length,
    gesamt: sessions.length,
  }
}

export function trainingszeitDaten(sessions: TrainingSession[]) {
  const jetzt = Date.now()
  return {
    woche: sessions
      .filter(s => jetzt - new Date(s.started_at).getTime() <= 7 * 864e5)
      .reduce((a, s) => a + (s.minutes ?? 0), 0),
    gesamt: sessions.reduce((a, s) => a + (s.minutes ?? 0), 0),
  }
}

export function dayTonnageFromSets(exerciseIds: string[], sets: LoggedSet[]) {
  return tonnageOf(sets.filter(s => exerciseIds.includes(s.exercise_id)))
}

export type { TagFortschritt }
