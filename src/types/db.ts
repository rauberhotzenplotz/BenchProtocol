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
  /** Seit wann die aktuelle Woche läuft. Steuert den Wochenwechsel nicht
      mehr (der hängt an den erledigten Einheiten, siehe
      training/wochenAbschluss.ts), dient aber weiter als Anzeige- und
      Auswertungsstempel. */
  week_started_at: string
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
  /** Gesetzt → baseE1RM() nutzt die RPE-Tabelle statt Epley (rir). */
  rpe: number | null
  /** Begründung des letzten automatischen Blockabschlusses. */
  last_delta_note: string | null
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
  /** Verknüpfung zum Volumen-Kontrollblatt (VolumeRow.muscle_group) — Basis
      für das automatisch aus echten Sätzen berechnete Wochenvolumen. */
  muscle_group: string | null
  sort_order: number
}

/** Übungskatalog: von Hand angelegte Vorlagen (nur Name/Schema/Pause)
    und importierte Katalogeinträge (alle übrigen Felder) nebeneinander
    in derselben Tabelle — importierte Zeilen tragen einfach mehr aus.
    Wird beim Anlegen einer Übung nur kopiert (siehe UebungAuswahl) —
    keine dauerhafte Verknüpfung, die Übung bleibt danach unabhängig
    editierbar. */
export interface ExerciseLibraryEntry {
  id: string
  user_id: string
  name: string
  scheme: string | null
  rest: string | null
  sort_order: number
  created_at: string
  /** Gesetzt bei den Bankdrücken-Varianten (schwer/leicht/deload) —
      beim Anlegen aus dieser Vorlage übernimmt die neue Übung diese
      Bank-Zuordnung automatisch, die wöchentliche Gewichtsberechnung
      läuft danach wie gewohnt über bench_progression. */
  bench_slot: BenchSlot | null
  /** Englischer und ungekürzter deutscher Name — nur fürs Suchen, die
      Anzeige nutzt ausschließlich "name". */
  name_en: string | null
  name_de_raw: string | null
  difficulty: string | null
  muscle_group: string | null
  primary_muscle: string | null
  secondary_muscle: string | null
  tertiary_muscle: string | null
  equipment: string | null
  body_position: string | null
  hand_pattern: string | null
  arm_pattern: string | null
  grip: string | null
  leg_pattern: string | null
  body_region: string | null
  mechanic: string | null
  laterality: string | null
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
  /** Gehört dieser Satz zu einem laufenden RPE-Block als Wochen-Eintrag. */
  rpe_block_id: string | null
  created_at: string
}

export type SessionStatus = 'completed' | 'skipped'

export interface TrainingSession {
  id: string
  day_id: string
  user_id: string
  week: number
  started_at: string
  ended_at: string | null
  minutes: number | null
  status: SessionStatus
  /** Gesetzt, solange die Einheit pausiert ist — null im Normalzustand
      und nach "Fortsetzen". */
  paused_at: string | null
}

export type RpeBlockStatus = 'active' | 'completed' | 'abandoned'

/** Siehe supabase/migrations/0003_rpe_blocks.sql — eigenständiges Modul für
    RPE-basierte Blockprogression, unabhängig von der Bank-Progression. */
export interface RpeBlock {
  id: string
  exercise_id: string
  user_id: string
  start_date: string
  planned_weeks: number
  status: RpeBlockStatus
  plate: number
  created_at: string
}

export interface RpePlannedSet {
  id: string
  block_id: string
  user_id: string
  week_number: number
  target_reps: number
  target_rpe: number
  target_weight: number | null
  /** Tatsächlicher Top-Satz dieser Woche — siehe topSatzDerWoche() in
      src/features/rpeblock/blockAuswertung.ts. Eigene Spalten statt
      logged_sets, siehe 0004_rpe_block_actuals.sql. */
  actual_weight: number | null
  actual_reps: number | null
  actual_rpe: number | null
  logged_at: string | null
}
