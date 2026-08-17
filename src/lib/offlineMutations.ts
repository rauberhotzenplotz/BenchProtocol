/** Zentrale Registrierung der offline-fähigen Trainings-Mutationen.
    Grund für die Auslagerung aus src/features/training/queries.ts: Mutations-
    Funktionen sind nicht serialisierbar. Wenn eine pausierte Mutation (weil
    offline) aus dem localStorage-Persister wiederhergestellt wird (nach
    Reload/App-Neustart), kennt TanStack Query nur den mutationKey — die
    tatsächliche Funktion muss vorher einmalig über setMutationDefaults()
    registriert worden sein, sonst weiß die App nach einem Reload während
    einer Offline-Phase nicht mehr, was beim Wiederverbinden passieren soll.
    Siehe TanStack-Doku "Offline Mutations". Registrierung erfolgt in
    main.tsx, einmalig, bevor die App gerendert wird. */

import type { QueryClient, QueryKey, Query } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { LoggedSet, TrainingSession, PlanTyp } from '../types/db'
import { advanceBlockIfDue } from '../features/bench/queries'
import {
  upsertInArray,
  removeFromArray,
  arrayContainsId,
  buildOptimisticSession,
  upsertSessionInArray,
  matchesExerciseWeek,
  matchesDayWeek,
} from '../features/training/offlineCache'

export const MUTATION_KEYS = {
  upsertSet: ['upsertSet'],
  deleteSet: ['deleteSet'],
  startSession: ['startSession'],
  endSession: ['endSession'],
  skipSession: ['skipSession'],
} as const

type SetsContext = { prevSets: Array<[QueryKey, LoggedSet[] | undefined]>; prevSetsAll: Array<[QueryKey, LoggedSet[] | undefined]> }

function rollbackSets(qc: QueryClient, ctx: SetsContext | undefined) {
  ctx?.prevSets.forEach(([key, data]) => qc.setQueryData<LoggedSet[]>(key, data))
  ctx?.prevSetsAll.forEach(([key, data]) => qc.setQueryData<LoggedSet[]>(key, data))
}

type SessionsContext = {
  prevSession: TrainingSession | null | undefined
  prevSessions: Array<[QueryKey, TrainingSession[] | undefined]>
  prevSessionsAll: Array<[QueryKey, TrainingSession[] | undefined]>
}

function rollbackSessions(qc: QueryClient, dayId: string, week: number, ctx: SessionsContext | undefined) {
  if (!ctx) return
  qc.setQueryData(['session', dayId, week], ctx.prevSession)
  ctx.prevSessions.forEach(([key, data]) => qc.setQueryData<TrainingSession[]>(key, data))
  ctx.prevSessionsAll.forEach(([key, data]) => qc.setQueryData<TrainingSession[]>(key, data))
}

export function registerOfflineMutationDefaults(qc: QueryClient) {
  // ── Sätze ────────────────────────────────────────────────────────
  qc.setMutationDefaults(MUTATION_KEYS.upsertSet, {
    mutationFn: async (row: {
      exercise_id: string
      week: number
      position: number
      kg?: number | null
      reps?: number | null
      rpe?: number | null
      done?: boolean
      done_at?: string | null
    }) => {
      const { data, error } = await supabase
        .from('logged_sets')
        .upsert(row, { onConflict: 'exercise_id,week,position' })
        .select()
        .single()
      if (error) throw error
      return data as LoggedSet
    },
    onMutate: async row => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      await qc.cancelQueries({ queryKey: ['sets-all'] })
      const prevSets = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets'] })
      const prevSetsAll = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] })
      qc.setQueriesData<LoggedSet[]>(
        { queryKey: ['sets'], predicate: (q: Query) => matchesExerciseWeek(q.queryKey[1] as string[], q.queryKey[2] as number, row.exercise_id, row.week) },
        old => upsertInArray(old, row),
      )
      qc.setQueriesData<LoggedSet[]>(
        { queryKey: ['sets-all'], predicate: (q: Query) => (q.queryKey[1] as string[]).includes(row.exercise_id) },
        old => upsertInArray(old, row),
      )
      return { prevSets, prevSetsAll } satisfies SetsContext
    },
    onError: (_err, _row, ctx) => rollbackSets(qc, ctx as SetsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
    },
  })

  qc.setMutationDefaults(MUTATION_KEYS.deleteSet, {
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logged_sets').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      await qc.cancelQueries({ queryKey: ['sets-all'] })
      const prevSets = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets'] })
      const prevSetsAll = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] })
      qc.setQueriesData<LoggedSet[]>(
        { queryKey: ['sets'], predicate: (q: Query) => arrayContainsId(q.state.data as LoggedSet[] | undefined, id) },
        old => removeFromArray(old, id),
      )
      qc.setQueriesData<LoggedSet[]>(
        { queryKey: ['sets-all'], predicate: (q: Query) => arrayContainsId(q.state.data as LoggedSet[] | undefined, id) },
        old => removeFromArray(old, id),
      )
      return { prevSets, prevSetsAll } satisfies SetsContext
    },
    onError: (_err, _id, ctx) => rollbackSets(qc, ctx as SetsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
    },
  })

  // ── Einheiten ────────────────────────────────────────────────────
  qc.setMutationDefaults(MUTATION_KEYS.startSession, {
    mutationFn: async ({ dayId, week }: { dayId: string; week: number }) => {
      const { data, error } = await supabase
        .from('sessions')
        .upsert(
          { day_id: dayId, week, started_at: new Date().toISOString(), ended_at: null, minutes: null, status: 'completed' },
          { onConflict: 'day_id,week' },
        )
        .select()
        .single()
      if (error) throw error
      return data as TrainingSession
    },
    onMutate: async ({ dayId, week }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      const optimistic = buildOptimisticSession(prevSession, {
        day_id: dayId,
        week,
        started_at: new Date().toISOString(),
        ended_at: null,
        minutes: null,
        status: 'completed',
      })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => matchesDayWeek(q.queryKey[1] as string[], q.queryKey[2] as number, dayId, week) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => (q.queryKey[1] as string[]).includes(dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-all'] })
    },
  })

  qc.setMutationDefaults(MUTATION_KEYS.skipSession, {
    mutationFn: async ({ dayId, week }: { dayId: string; week: number }) => {
      const jetzt = new Date().toISOString()
      const { error } = await supabase
        .from('sessions')
        .upsert({ day_id: dayId, week, started_at: jetzt, ended_at: jetzt, minutes: 0, status: 'skipped' }, { onConflict: 'day_id,week' })
      if (error) throw error
    },
    onMutate: async ({ dayId, week }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      const jetzt = new Date().toISOString()
      const optimistic = buildOptimisticSession(prevSession, { day_id: dayId, week, started_at: jetzt, ended_at: jetzt, minutes: 0, status: 'skipped' })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => matchesDayWeek(q.queryKey[1] as string[], q.queryKey[2] as number, dayId, week) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => (q.queryKey[1] as string[]).includes(dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-all'] })
    },
  })

  qc.setMutationDefaults(MUTATION_KEYS.endSession, {
    mutationFn: async ({ id, startedAt }: { id: string; startedAt: string; dayId: string; week: number; planId: string; planTyp: PlanTyp }) => {
      const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
      const { error } = await supabase
        .from('sessions')
        .update({ ended_at: new Date().toISOString(), minutes })
        .eq('id', id)
      if (error) throw error
      return minutes
    },
    onMutate: async ({ dayId, week, startedAt }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
      const optimistic = buildOptimisticSession(prevSession, { day_id: dayId, week, ended_at: new Date().toISOString(), minutes })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => matchesDayWeek(q.queryKey[1] as string[], q.queryKey[2] as number, dayId, week) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => (q.queryKey[1] as string[]).includes(dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: async (_minutes, variables) => {
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['sessions-all'] })
      // Bewusst erst hier, nicht am Aufrufort in SessionView/GymMode: läuft
      // dadurch garantiert erst, nachdem endSession serverseitig bestätigt
      // ist — auch wenn das erst nach einer Offline-Phase/Reload passiert.
      if (variables.planTyp === 'bench') {
        await advanceBlockIfDue(qc, variables.planId)
      }
    },
  })
}
