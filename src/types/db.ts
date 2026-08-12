/** Handgeschriebene Typen passend zu supabase/migrations/0001_init.sql.
    Kein `supabase gen types` in dieser Runde — dafür bräuchte es einen
    per CLI eingeloggten Zugriff auf das Projekt. Wer das später einrichtet,
    kann diese Datei 1:1 durch die generierten Typen ersetzen. */

export type PlanTyp = 'bench' | 'general'
export type BenchSlot = 'd1' | 'd3'

export interface Plan {
  id: string
  user_id: string
  name: string
  typ: PlanTyp
  week: number
  sort_order: number
  /** Nur bei typ === 'bench' gesetzt. */
  work: number | null
  reps: number | null
  rir: number | null
  plate: number | null
  block: number | null
  goal: number | null
  goal_from: number | null
  beruehrt: boolean
  created_at: string
  updated_at: string
}

export interface PlanDay {
  id: string
  plan_id: string
  user_id: string
  name: string
  sub: string | null
  sort_order: number
}

export interface Exercise {
  id: string
  day_id: string
  user_id: string
  name: string
  scheme: string | null
  rest: string | null
  note: string | null
  bench_slot: BenchSlot | null
  sort_order: number
}

export interface BenchProgressionRow {
  id: string
  plan_id: string
  user_id: string
  slot: BenchSlot
  week: number
  scheme: string | null
  pct: number | null
  hint: string | null
}

export interface VolumeRow {
  id: string
  plan_id: string
  user_id: string
  muscle_group: string
  /** { [dayId]: Sätze } */
  sets_by_day: Record<string, number>
  note: string | null
  sort_order: number
}

export interface LoggedSet {
  id: string
  exercise_id: string
  user_id: string
  week: number
  position: number
  kg: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  /** Zeitpunkt, zu dem der Haken gesetzt wurde — Grundlage der Übungsdauer. */
  done_at: string | null
  created_at: string
}

export interface TrainingSession {
  id: string
  day_id: string
  user_id: string
  week: number
  started_at: string
  ended_at: string | null
  minutes: number | null
}
