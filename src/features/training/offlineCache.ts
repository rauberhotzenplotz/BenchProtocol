/** Reine Hilfsfunktionen für optimistische Cache-Patches bei Offline-
    Mutationen (siehe src/lib/offlineMutations.ts). Kein Netzwerkzugriff,
    keine Query-Client-Abhängigkeit — nur Array-in-Array-out, damit sie sich
    trivial unit-testen lassen. */

import type { LoggedSet, TrainingSession } from '../../types/db'

type UpsertSetRow = {
  exercise_id: string
  week: number
  position: number
  kg?: number | null
  reps?: number | null
  rpe?: number | null
  done?: boolean
  done_at?: string | null
}

/** Ersetzt einen bestehenden Satz (gleiche exercise_id/week/position) oder
    hängt einen neuen optimistischen Eintrag mit Platzhalter-id an — die
    echte id kommt erst mit der Server-Antwort, danach übernimmt
    invalidateQueries die endgültigen Daten. */
export function upsertInArray(old: LoggedSet[] | undefined, row: UpsertSetRow): LoggedSet[] {
  const liste = old ?? []
  const idx = liste.findIndex(
    s => s.exercise_id === row.exercise_id && s.week === row.week && s.position === row.position,
  )
  if (idx === -1) {
    const neu: LoggedSet = {
      id: crypto.randomUUID(),
      exercise_id: row.exercise_id,
      user_id: '',
      week: row.week,
      position: row.position,
      kg: row.kg ?? null,
      reps: row.reps ?? null,
      rpe: row.rpe ?? null,
      done: row.done ?? false,
      done_at: row.done_at ?? null,
      rpe_block_id: null,
      created_at: new Date().toISOString(),
    }
    return [...liste, neu]
  }
  const patch: Partial<LoggedSet> = {}
  if ('kg' in row) patch.kg = row.kg ?? null
  if ('reps' in row) patch.reps = row.reps ?? null
  if ('rpe' in row) patch.rpe = row.rpe ?? null
  if ('done' in row) patch.done = row.done ?? false
  if ('done_at' in row) patch.done_at = row.done_at ?? null
  return liste.map((s, i) => (i === idx ? { ...s, ...patch } : s))
}

export function removeFromArray(old: LoggedSet[] | undefined, id: string): LoggedSet[] {
  return (old ?? []).filter(s => s.id !== id)
}

export function arrayContainsId(old: LoggedSet[] | undefined, id: string): boolean {
  return (old ?? []).some(s => s.id === id)
}

type SessionPatch = {
  day_id: string
  week: number
  started_at?: string
  ended_at?: string | null
  minutes?: number | null
  status?: TrainingSession['status']
}

/** Baut einen optimistischen Session-Eintrag: übernimmt Felder aus einer
    vorhandenen Session (falls in `old` vorhanden), sonst legt einen neuen
    Platzhalter mit Defaults an. */
export function buildOptimisticSession(old: TrainingSession | null | undefined, patch: SessionPatch): TrainingSession {
  return {
    id: old?.id ?? crypto.randomUUID(),
    day_id: patch.day_id,
    user_id: old?.user_id ?? '',
    week: patch.week,
    started_at: patch.started_at ?? old?.started_at ?? new Date().toISOString(),
    ended_at: patch.ended_at !== undefined ? patch.ended_at : (old?.ended_at ?? null),
    minutes: patch.minutes !== undefined ? patch.minutes : (old?.minutes ?? null),
    status: patch.status ?? old?.status ?? 'completed',
  }
}

export function upsertSessionInArray(old: TrainingSession[] | undefined, session: TrainingSession): TrainingSession[] {
  const liste = old ?? []
  const idx = liste.findIndex(s => s.day_id === session.day_id && s.week === session.week)
  if (idx === -1) return [...liste, session]
  return liste.map((s, i) => (i === idx ? session : s))
}

export function matchesExerciseWeek(exerciseIds: readonly string[], week: number, exerciseId: string, targetWeek: number): boolean {
  return week === targetWeek && exerciseIds.includes(exerciseId)
}

export function matchesDayWeek(dayIds: readonly string[], week: number, dayId: string, targetWeek: number): boolean {
  return week === targetWeek && dayIds.includes(dayId)
}
