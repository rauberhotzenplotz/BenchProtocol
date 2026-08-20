import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Exercise, LoggedSet, PlanDay, PlanTyp, TrainingSession } from '../../types/db'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { TagAnlegen, UebungAnlegen } from '../../lib/offline/training'

export type DayWithExercises = PlanDay & { exercises: Exercise[] }

export function useDays(planId: string | undefined) {
  return useQuery({
    queryKey: ['days', planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_days')
        .select('*, exercises(*)')
        .eq('plan_id', planId!)
        .order('sort_order')
      if (error) throw error
      // Verschachtelte Übungen kommen unsortiert aus der Embed-Abfrage —
      // client-seitig sortieren statt auf einen bestimmten Options-
      // Parameternamen der supabase-js-Version zu setzen.
      return (data as DayWithExercises[]).map(d => ({
        ...d,
        exercises: [...d.exercises].sort((a, b) => a.sort_order - b.sort_order),
      }))
    },
  })
}

/** Alle Übungen über alle Pläne hinweg, nicht nur den aktiven — RLS grenzt
    ohnehin auf den angemeldeten Nutzer ein. Grundlage für planübergreifende
    Rekorde (RecordsPage): dieselbe Katalog-Übung kann in mehreren Plänen
    angelegt sein, über exercises.library_id lassen sich ihre Sätze
    trotzdem zu einer gemeinsamen Bestenliste zusammenfassen. */
export function useAlleUebungenJemals() {
  return useQuery({
    queryKey: ['exercises-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) throw error
      return data as Exercise[]
    },
  })
}

// Alle schreibenden Hooks tragen nur noch ihren Schlüssel; Verhalten,
// optimistische Cache-Updates und Rollback stehen zentral in
// src/lib/offline/training.ts. Die Zeilen bringen ihre Zugehörigkeit selbst
// mit (plan_id/day_id), deshalb brauchen die Hooks keine planId mehr.
export function useCreateDay() {
  return useMutation<void, Error, TagAnlegen>({ mutationKey: MUTATION_KEYS.createDay })
}

export function useUpdateDay() {
  return useMutation<void, Error, { id: string; patch: Partial<PlanDay> }>({ mutationKey: MUTATION_KEYS.updateDay })
}

export function useDeleteDay() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteDay })
}

export function useCreateExercise() {
  return useMutation<void, Error, UebungAnlegen>({ mutationKey: MUTATION_KEYS.createExercise })
}

export function useUpdateExercise() {
  return useMutation<void, Error, { id: string; patch: Partial<Exercise> }>({ mutationKey: MUTATION_KEYS.updateExercise })
}

export function useDeleteExercise() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteExercise })
}

// ── Sätze ──────────────────────────────────────────────────────────

/** `bereich` ist der stabile Teil des Cache-Schlüssels — in aller Regel die
    Plan-ID, für planübergreifende Auswertungen 'alle'.

    Warum nicht die Übungs-IDs selbst, wie ursprünglich: Der Schlüssel
    änderte sich dann bei jeder hinzugefügten Übung. Ohne Netz gab es für
    den neuen Schlüssel noch keinen Cache-Eintrag, die optimistischen
    Updates aus lib/offline/cache.ts liefen ins Leere (setQueriesData
    schreibt nur in bereits vorhandene Einträge) und die Satzliste blieb
    leer. Mit einem festen Schlüssel je Plan überlebt der Cache das
    Hinzufügen von Übungen. Die IDs bestimmen weiterhin, was geladen wird —
    nur eben nicht mehr, wohin es im Cache gehört. */
export function useSetsForExercises(exerciseIds: string[], week: number, bereich: string) {
  return useQuery({
    queryKey: ['sets', bereich, week],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logged_sets')
        .select('*')
        .in('exercise_id', exerciseIds)
        .eq('week', week)
        .order('position')
      if (error) throw error
      return data as LoggedSet[]
    },
  })
}

/** Ungefiltert nach Woche — für Cockpit-Auswertungen wie "Tonnage letztes
    Training", die über mehrere Wochen hinweg schauen müssen. */
export function useAllSetsForExercises(exerciseIds: string[], bereich: string) {
  return useQuery({
    queryKey: ['sets-all', bereich],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('logged_sets').select('*').in('exercise_id', exerciseIds)
      if (error) throw error
      return data as LoggedSet[]
    },
  })
}

// mutationFn/onMutate/onError/onSuccess sind zentral in
// src/lib/offlineMutations.ts registriert (registerOfflineMutationDefaults,
// aufgerufen in main.tsx) — nötig, damit eine offline pausierte Mutation
// auch nach einem Reload noch weiß, was sie beim Wiederverbinden tun soll
// (Mutationsfunktionen sind nicht serialisierbar, mutationKey schon).
export function useUpsertSet() {
  return useMutation<
    LoggedSet,
    Error,
    { exercise_id: string; week: number; position: number; kg?: number | null; reps?: number | null; rpe?: number | null; done?: boolean; done_at?: string | null }
  >({ mutationKey: MUTATION_KEYS.upsertSet })
}

export function useDeleteSet() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteSet })
}

// ── Einheiten (Start/Ende) ───────────────────────────────────────────

/** Alle Sitzungen mehrerer Tage einer Woche in einem Rutsch — für die
    Tage-Übersicht, damit sie nicht pro Tag einzeln nachfragen muss. */
export function useSessionsForDays(dayIds: string[], week: number, bereich: string) {
  return useQuery({
    queryKey: ['sessions', bereich, week],
    enabled: dayIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .in('day_id', dayIds)
        .eq('week', week)
      if (error) throw error
      return data as TrainingSession[]
    },
  })
}

/** Für Cockpit-Kennzahlen (Frequenz, Trainingszeit, letzte Einheiten) —
    über alle Wochen hinweg, nicht nur die aktuell angezeigte. */
export function useAllSessionsForDays(dayIds: string[], bereich: string) {
  return useQuery({
    queryKey: ['sessions-all', bereich],
    enabled: dayIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .in('day_id', dayIds)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data as TrainingSession[]
    },
  })
}

export function useSession(dayId: string | undefined, week: number) {
  return useQuery({
    queryKey: ['session', dayId, week],
    enabled: !!dayId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('day_id', dayId!)
        .eq('week', week)
        .maybeSingle()
      if (error) throw error
      return data as TrainingSession | null
    },
  })
}

export function useStartSession() {
  return useMutation<TrainingSession, Error, { dayId: string; week: number }>({ mutationKey: MUTATION_KEYS.startSession })
}

/** dayId/week/planId/planTyp werden nur für den offline-optimistischen
    Cache-Write bzw. den automatischen Block-Check nach Erfolg gebraucht
    (siehe registerOfflineMutationDefaults) — der eigentliche Supabase-
    Aufruf nutzt weiterhin nur id/startedAt. */
export function useEndSession() {
  return useMutation<number, Error, { id: string; startedAt: string; dayId: string; week: number; planId: string; planTyp: PlanTyp }>({
    mutationKey: MUTATION_KEYS.endSession,
  })
}

/** Löscht eine aufgezeichnete Einheit wieder — samt der geloggten Sätze
    dieses Tages in dieser Woche (sonst blieben verwaiste Sätze übrig, die
    Kalender/Cockpit weiter mitzählen würden). */
export function useDeleteSession() {
  return useMutation<void, Error, { sessionId: string; week: number; exerciseIds: string[] }>({
    mutationKey: MUTATION_KEYS.deleteSession,
  })
}

/** Markiert eine Einheit als bewusst übersprungen (z. B. Zeitmangel) —
    zählt nicht in Frequenz/Trainingszeit, taucht aber im Kalender auf,
    statt so auszusehen, als sei der Tag nie angefasst worden. */
export function useSkipSession() {
  return useMutation<void, Error, { dayId: string; week: number }>({ mutationKey: MUTATION_KEYS.skipSession })
}

/** Hält eine laufende Einheit an, ohne sie zu beenden — die Gegenstelle zu
    useResumeSession() unten. */
export function usePauseSession() {
  return useMutation<void, Error, { id: string; dayId: string; week: number }>({ mutationKey: MUTATION_KEYS.pauseSession })
}

/** Setzt eine pausierte Einheit fort: verschiebt started_at um die
    Pausendauer nach vorn, damit die spätere Dauer-Berechnung in
    useEndSession() die Pause nicht mitzählt. */
export function useResumeSession() {
  return useMutation<void, Error, { id: string; dayId: string; week: number; startedAt: string; pausedAt: string }>({
    mutationKey: MUTATION_KEYS.resumeSession,
  })
}

/** Setzt nur die geloggten Sätze einer Einheit zurück — anders als
    useDeleteSession() bleibt die Session (und damit ihre Dauer) bestehen. */
export function useResetSessionSets() {
  return useMutation<void, Error, { exerciseIds: string[]; week: number }>({ mutationKey: MUTATION_KEYS.resetSessionSets })
}
