import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Exercise, LoggedSet, PlanDay, PlanTyp, TrainingSession } from '../../types/db'
import { MUTATION_KEYS } from '../../lib/offlineMutations'

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

function invalidateDays(qc: ReturnType<typeof useQueryClient>, planId: string | undefined) {
  return qc.invalidateQueries({ queryKey: ['days', planId] })
}

export function useCreateDay(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, sortOrder }: { name: string; sortOrder: number }) => {
      const { data, error } = await supabase
        .from('plan_days')
        .insert({ plan_id: planId, name, sort_order: sortOrder })
        .select()
        .single()
      if (error) throw error
      return data as PlanDay
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

export function useUpdateDay(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlanDay> }) => {
      const { error } = await supabase.from('plan_days').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

export function useDeleteDay(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_days').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

export function useCreateExercise(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      row: Pick<Exercise, 'day_id' | 'name' | 'scheme' | 'rest' | 'note' | 'bench_slot' | 'muscle_group'> & { sort_order: number }
    ) => {
      const { data, error } = await supabase.from('exercises').insert(row).select().single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

export function useUpdateExercise(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Exercise> }) => {
      const { error } = await supabase.from('exercises').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

export function useDeleteExercise(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateDays(qc, planId),
  })
}

// ── Sätze ──────────────────────────────────────────────────────────

export function useSetsForExercises(exerciseIds: string[], week: number) {
  return useQuery({
    queryKey: ['sets', [...exerciseIds].sort(), week],
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
export function useAllSetsForExercises(exerciseIds: string[]) {
  return useQuery({
    queryKey: ['sets-all', [...exerciseIds].sort()],
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
export function useSessionsForDays(dayIds: string[], week: number) {
  return useQuery({
    queryKey: ['sessions', [...dayIds].sort(), week],
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
export function useAllSessionsForDays(dayIds: string[]) {
  return useQuery({
    queryKey: ['sessions-all', [...dayIds].sort()],
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, week, exerciseIds }: { sessionId: string; week: number; exerciseIds: string[] }) => {
      if (exerciseIds.length) await supabase.from('logged_sets').delete().in('exercise_id', exerciseIds).eq('week', week)
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-all'] })
    },
  })
}

/** Markiert eine Einheit als bewusst übersprungen (z. B. Zeitmangel) —
    zählt nicht in Frequenz/Trainingszeit, taucht aber im Kalender auf,
    statt so auszusehen, als sei der Tag nie angefasst worden. */
export function useSkipSession() {
  return useMutation<void, Error, { dayId: string; week: number }>({ mutationKey: MUTATION_KEYS.skipSession })
}
