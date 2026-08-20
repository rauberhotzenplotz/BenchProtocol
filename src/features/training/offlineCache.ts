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
  paused_at?: string | null
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
    paused_at: patch.paused_at !== undefined ? patch.paused_at : (old?.paused_at ?? null),
  }
}

export function upsertSessionInArray(old: TrainingSession[] | undefined, session: TrainingSession): TrainingSession[] {
  const liste = old ?? []
  const idx = liste.findIndex(s => s.day_id === session.day_id && s.week === session.week)
  if (idx === -1) return [...liste, session]
  return liste.map((s, i) => (i === idx ? session : s))
}

/** Gehört die Übung in den Cache-Bereich (= Plan-ID, siehe
    useSetsForExercises)?

    Die Satz- und Sitzungs-Caches liegen seit der Offline-Überarbeitung
    unter einem festen Bereich statt unter der Liste ihrer IDs. Ob ein
    optimistischer Patch in einen konkreten Eintrag gehört, lässt sich
    daher nicht mehr am Schlüssel ablesen — die Antwort steht im
    Tages-Cache desselben Bereichs.

    `tage === undefined` heißt: wir wissen es gerade nicht (Cache noch
    nicht geladen). Dann wird bewusst angewendet statt verworfen — ein
    Patch zu viel korrigiert sich beim nächsten Abgleich mit dem Server
    von selbst, ein verlorener Satz mitten im Training nicht. */
export function bereichEnthaeltUebung(
  tage: ReadonlyArray<{ exercises: ReadonlyArray<{ id: string }> }> | undefined,
  exerciseId: string,
): boolean {
  if (!tage) return true
  return tage.some(t => t.exercises.some(e => e.id === exerciseId))
}

export function bereichEnthaeltTag(
  tage: ReadonlyArray<{ id: string }> | undefined,
  dayId: string,
): boolean {
  if (!tage) return true
  return tage.some(t => t.id === dayId)
}
