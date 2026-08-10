import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Exercise, LoggedSet, PlanDay, TrainingSession } from '../../types/db'

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
    mutationFn: async (row: Pick<Exercise, 'day_id' | 'name' | 'scheme' | 'rest' | 'note'> & { sort_order: number }) => {
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

export function useUpsertSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: {
      exercise_id: string
      week: number
      position: number
      kg?: number | null
      reps?: number | null
      rpe?: number | null
      done?: boolean
    }) => {
      const { data, error } = await supabase
        .from('logged_sets')
        .upsert(row, { onConflict: 'exercise_id,week,position' })
        .select()
        .single()
      if (error) throw error
      return data as LoggedSet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sets'] }),
  })
}

export function useDeleteSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logged_sets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sets'] }),
  })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dayId, week }: { dayId: string; week: number }) => {
      const { data, error } = await supabase
        .from('sessions')
        .upsert(
          { day_id: dayId, week, started_at: new Date().toISOString(), ended_at: null, minutes: null },
          { onConflict: 'day_id,week' },
        )
        .select()
        .single()
      if (error) throw error
      return data as TrainingSession
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  })
}

export function useEndSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, startedAt }: { id: string; startedAt: string }) => {
      const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
      const { error } = await supabase
        .from('sessions')
        .update({ ended_at: new Date().toISOString(), minutes })
        .eq('id', id)
      if (error) throw error
      return minutes
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  })
}
