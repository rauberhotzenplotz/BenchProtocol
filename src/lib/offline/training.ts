import type { QueryClient, QueryKey, Query } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Exercise, LoggedSet, PlanDay, PlanTyp, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../../features/training/queries'
import { pruefeWochenabschluss } from '../../features/training/wochenAbschluss'
import { einheitMinuten, startNachPause } from '../../features/training/calc'
import {
  upsertInArray,
  removeFromArray,
  arrayContainsId,
  buildOptimisticSession,
  upsertSessionInArray,
  bereichEnthaeltUebung,
  bereichEnthaeltTag,
} from '../../features/training/offlineCache'
import { MUTATION_KEYS, SYNC_SCOPE } from './keys'
import { optimistisch, zurueckrollen, type Schnappschuss } from './cache'

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

export type TagAnlegen = Pick<PlanDay, 'id' | 'plan_id' | 'name' | 'sort_order'>
export type UebungAnlegen = Pick<
  Exercise,
  'id' | 'day_id' | 'name' | 'scheme' | 'rest' | 'note' | 'bench_slot' | 'muscle_group' | 'sort_order' | 'library_id'
>

export function registriereTrainingMutationen(qc: QueryClient) {
  // Die Satz-/Sitzungs-Caches liegen unter einem festen Bereich (Plan-ID,
  // bzw. 'alle' für die planübergreifenden Rekorde). Welche Übungen und
  // Tage dazugehören, steht im Tages-Cache desselben Bereichs.
  const tageDesBereichs = (bereich: unknown): DayWithExercises[] | undefined =>
    typeof bereich === 'string' ? qc.getQueryData<DayWithExercises[]>(['days', bereich]) : undefined

  const passtZuUebung = (q: Query, exerciseId: string) =>
    q.queryKey[1] === 'alle' || bereichEnthaeltUebung(tageDesBereichs(q.queryKey[1]), exerciseId)

  const passtZuTag = (q: Query, dayId: string) =>
    q.queryKey[1] === 'alle' || bereichEnthaeltTag(tageDesBereichs(q.queryKey[1]), dayId)

  // ── Tage und Übungen ─────────────────────────────────────────────
  // Der Tages-Cache liegt unter ['days', planId] und trägt die Übungen
  // verschachtelt mit (DayWithExercises). Gearbeitet wird bewusst über den
  // Präfix ['days'] statt über die konkrete planId: die Zeilen bringen ihre
  // Zugehörigkeit selbst mit (plan_id bzw. day_id), und so müssen die
  // Aufrufer die planId nicht durch jede Mutation schleifen.
  const tageFilter = { queryKey: ['days'] }
  const tageInvalidieren = () => qc.invalidateQueries(tageFilter)

  qc.setMutationDefaults<void, Error, TagAnlegen>(MUTATION_KEYS.createDay, {
    scope: SYNC_SCOPE,
    mutationFn: async row => {
      const { error } = await supabase.from('plan_days').insert(row)
      if (error) throw error
    },
    onMutate: row => {
      const neu: DayWithExercises = { ...row, user_id: '', sub: null, exercises: [] }
      return optimistisch<DayWithExercises>(qc, tageFilter, alt =>
        // Nur in den Cache des zugehörigen Plans einhängen.
        alt?.[0] && alt[0].plan_id !== row.plan_id ? alt : [...(alt ?? []), neu],
      )
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  qc.setMutationDefaults<void, Error, { id: string; patch: Partial<PlanDay> }>(MUTATION_KEYS.updateDay, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('plan_days').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      optimistisch<DayWithExercises>(qc, tageFilter, alt => (alt ?? []).map(t => (t.id === id ? { ...t, ...patch } : t))),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deleteDay, {
    scope: SYNC_SCOPE,
    mutationFn: async id => {
      const { error } = await supabase.from('plan_days').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: id => optimistisch<DayWithExercises>(qc, tageFilter, alt => (alt ?? []).filter(t => t.id !== id)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  qc.setMutationDefaults<void, Error, UebungAnlegen>(MUTATION_KEYS.createExercise, {
    scope: SYNC_SCOPE,
    mutationFn: async row => {
      const { error } = await supabase.from('exercises').insert(row)
      if (error) throw error
    },
    onMutate: row => {
      const neu: Exercise = { ...row, user_id: '' }
      return optimistisch<DayWithExercises>(qc, tageFilter, alt =>
        (alt ?? []).map(t => (t.id === row.day_id ? { ...t, exercises: [...t.exercises, neu] } : t)),
      )
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  qc.setMutationDefaults<void, Error, { id: string; patch: Partial<Exercise> }>(MUTATION_KEYS.updateExercise, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('exercises').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      optimistisch<DayWithExercises>(qc, tageFilter, alt =>
        (alt ?? []).map(t => ({ ...t, exercises: t.exercises.map(ex => (ex.id === id ? { ...ex, ...patch } : ex)) })),
      ),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deleteExercise, {
    scope: SYNC_SCOPE,
    mutationFn: async id => {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: id =>
      optimistisch<DayWithExercises>(qc, tageFilter, alt =>
        (alt ?? []).map(t => ({ ...t, exercises: t.exercises.filter(ex => ex.id !== id) })),
      ),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: tageInvalidieren,
  })

  // ── Sätze ────────────────────────────────────────────────────────
  qc.setMutationDefaults(MUTATION_KEYS.upsertSet, {
    scope: SYNC_SCOPE,
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
        { queryKey: ['sets'], predicate: (q: Query) => q.queryKey[2] === row.week && passtZuUebung(q, row.exercise_id) },
        old => upsertInArray(old, row),
      )
      qc.setQueriesData<LoggedSet[]>(
        { queryKey: ['sets-all'], predicate: (q: Query) => passtZuUebung(q, row.exercise_id) },
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
    scope: SYNC_SCOPE,
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
  const einheitenInvalidieren = () => {
    qc.invalidateQueries({ queryKey: ['session'] })
    qc.invalidateQueries({ queryKey: ['sessions'] })
    qc.invalidateQueries({ queryKey: ['sessions-all'] })
  }

  qc.setMutationDefaults(MUTATION_KEYS.startSession, {
    scope: SYNC_SCOPE,
    // startedAt kommt vom Aufrufer, nicht aus new Date() hier drin: Ohne
    // Netz liegt diese Mutation bis zur naechsten Verbindung in der
    // Warteschlange und haette sonst den Zeitpunkt des Synchronisierens
    // als Trainingsbeginn eingetragen. Gilt genauso fuer die drei
    // Einheiten-Mutationen darunter.
    mutationFn: async ({ dayId, week, startedAt }: { dayId: string; week: number; startedAt: string }) => {
      const { data, error } = await supabase
        .from('sessions')
        .upsert(
          { day_id: dayId, week, started_at: startedAt, ended_at: null, minutes: null, status: 'completed', paused_at: null },
          { onConflict: 'day_id,week' },
        )
        .select()
        .single()
      if (error) throw error
      return data as TrainingSession
    },
    onMutate: async ({ dayId, week, startedAt }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      const optimistic = buildOptimisticSession(prevSession, {
        day_id: dayId,
        week,
        started_at: startedAt,
        ended_at: null,
        minutes: null,
        status: 'completed',
        paused_at: null,
      })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => q.queryKey[2] === week && passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: einheitenInvalidieren,
  })

  qc.setMutationDefaults(MUTATION_KEYS.skipSession, {
    scope: SYNC_SCOPE,
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
        { queryKey: ['sessions'], predicate: (q: Query) => q.queryKey[2] === week && passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: einheitenInvalidieren,
  })

  qc.setMutationDefaults(MUTATION_KEYS.endSession, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, startedAt, endedAt }: { id: string; startedAt: string; endedAt: string; dayId: string; week: number; planId: string; planTyp: PlanTyp }) => {
      const minutes = einheitMinuten(startedAt, endedAt)
      const { error } = await supabase
        .from('sessions')
        .update({ ended_at: endedAt, minutes })
        .eq('id', id)
      if (error) throw error
      return minutes
    },
    onMutate: async ({ dayId, week, startedAt, endedAt }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      // Dieselben Werte wie im mutationFn — vorher rechneten beide je
      // eigenstaendig mit Date.now(), die Anzeige wich dadurch von dem ab,
      // was schliesslich in der Datenbank landete.
      const minutes = einheitMinuten(startedAt, endedAt)
      const optimistic = buildOptimisticSession(prevSession, { day_id: dayId, week, ended_at: endedAt, minutes })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => q.queryKey[2] === week && passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: async (_minutes, variables) => {
      einheitenInvalidieren()
      // Bewusst erst hier, nicht am Aufrufort in SessionView/GymMode: läuft
      // dadurch garantiert erst, nachdem endSession serverseitig bestätigt
      // ist — auch wenn das erst nach einer Offline-Phase/Reload passiert.
      // Der Abschluss-Check liest frische Serverdaten und ist selbst nicht
      // offline-fähig; genau deshalb hängt er hier und nicht am Knopf. Gilt
      // für jeden Plantyp und jede Woche — sobald alle Tage der laufenden
      // Woche erledigt sind, schaltet sie sofort weiter. Dieselbe Prüfung
      // läuft zusätzlich beim Laden (useWochenAbschluss in AppShell.tsx),
      // falls eine Woche auf anderem Weg vollständig wird.
      await pruefeWochenabschluss(qc, variables.planId)
    },
  })

  qc.setMutationDefaults<void, Error, { sessionId: string; week: number; exerciseIds: string[] }>(MUTATION_KEYS.deleteSession, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ sessionId, week, exerciseIds }: { sessionId: string; week: number; exerciseIds: string[] }) => {
      if (exerciseIds.length) await supabase.from('logged_sets').delete().in('exercise_id', exerciseIds).eq('week', week)
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
      if (error) throw error
    },
    onMutate: async ({ sessionId, week, exerciseIds }) => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      const prevSets = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets'] })
      const prevSetsAll = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] })
      const gehoertDazu = (s: LoggedSet) => s.week === week && exerciseIds.includes(s.exercise_id)
      qc.setQueriesData<LoggedSet[]>({ queryKey: ['sets'] }, old => (old ?? []).filter(s => !gehoertDazu(s)))
      qc.setQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] }, old => (old ?? []).filter(s => !gehoertDazu(s)))
      qc.setQueriesData<TrainingSession[]>({ queryKey: ['sessions'] }, old => (old ?? []).filter(s => s.id !== sessionId))
      qc.setQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] }, old => (old ?? []).filter(s => s.id !== sessionId))
      return { prevSets, prevSetsAll } satisfies SetsContext
    },
    onError: (_err, _v, ctx) => rollbackSets(qc, ctx as SetsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
      einheitenInvalidieren()
    },
  })

  qc.setMutationDefaults<void, Error, { id: string; dayId: string; week: number; pausedAt: string }>(MUTATION_KEYS.pauseSession, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, pausedAt }) => {
      const { error } = await supabase.from('sessions').update({ paused_at: pausedAt }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ dayId, week, pausedAt }) => {
      await qc.cancelQueries({ queryKey: ['session', dayId, week] })
      await qc.cancelQueries({ queryKey: ['sessions'] })
      await qc.cancelQueries({ queryKey: ['sessions-all'] })
      const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
      const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
      const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
      const optimistic = buildOptimisticSession(prevSession, { day_id: dayId, week, paused_at: pausedAt })
      qc.setQueryData(['session', dayId, week], optimistic)
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions'], predicate: (q: Query) => q.queryKey[2] === week && passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      qc.setQueriesData<TrainingSession[]>(
        { queryKey: ['sessions-all'], predicate: (q: Query) => passtZuTag(q, dayId) },
        old => upsertSessionInArray(old, optimistic),
      )
      return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
    },
    onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
    onSuccess: einheitenInvalidieren,
  })

  qc.setMutationDefaults<void, Error, { id: string; dayId: string; week: number; startedAt: string; pausedAt: string; jetzt: string }>(
    MUTATION_KEYS.resumeSession,
    {
      scope: SYNC_SCOPE,
      // Die Pausendauer wird auf started_at aufgeschlagen, statt paused_at
      // einfach nur zu löschen: sonst zählte die in endSession aus der
      // Zeitdifferenz berechnete Dauer die Pause mit. Ist rechnerisch
      // dasselbe wie "eine Stoppuhr anhalten und weiterlaufen lassen".
      mutationFn: async ({ id, startedAt, pausedAt, jetzt }) => {
        const neuerStart = startNachPause(startedAt, pausedAt, jetzt)
        const { error } = await supabase.from('sessions').update({ started_at: neuerStart, paused_at: null }).eq('id', id)
        if (error) throw error
      },
      onMutate: async ({ dayId, week, startedAt, pausedAt, jetzt }) => {
        await qc.cancelQueries({ queryKey: ['session', dayId, week] })
        await qc.cancelQueries({ queryKey: ['sessions'] })
        await qc.cancelQueries({ queryKey: ['sessions-all'] })
        const prevSession = qc.getQueryData<TrainingSession | null>(['session', dayId, week])
        const prevSessions = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions'] })
        const prevSessionsAll = qc.getQueriesData<TrainingSession[]>({ queryKey: ['sessions-all'] })
        const neuerStart = startNachPause(startedAt, pausedAt, jetzt)
        const optimistic = buildOptimisticSession(prevSession, { day_id: dayId, week, started_at: neuerStart, paused_at: null })
        qc.setQueryData(['session', dayId, week], optimistic)
        qc.setQueriesData<TrainingSession[]>(
          { queryKey: ['sessions'], predicate: (q: Query) => q.queryKey[2] === week && passtZuTag(q, dayId) },
          old => upsertSessionInArray(old, optimistic),
        )
        qc.setQueriesData<TrainingSession[]>(
          { queryKey: ['sessions-all'], predicate: (q: Query) => passtZuTag(q, dayId) },
          old => upsertSessionInArray(old, optimistic),
        )
        return { prevSession, prevSessions, prevSessionsAll } satisfies SessionsContext
      },
      onError: (_err, { dayId, week }, ctx) => rollbackSessions(qc, dayId, week, ctx as SessionsContext | undefined),
      onSuccess: einheitenInvalidieren,
    },
  )

  // Setzt nur die geloggten Sätze zurück, nicht die Session selbst — anders
  // als deleteSession oben. Entspricht dem live beobachteten Verhalten von
  // Alpha Progression: die Dauer der Einheit läuft nach einem Reset weiter,
  // nur die Werte sind wieder leer.
  qc.setMutationDefaults<void, Error, { exerciseIds: string[]; week: number }>(MUTATION_KEYS.resetSessionSets, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ exerciseIds, week }) => {
      if (!exerciseIds.length) return
      const { error } = await supabase.from('logged_sets').delete().in('exercise_id', exerciseIds).eq('week', week)
      if (error) throw error
    },
    onMutate: async ({ exerciseIds, week }) => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      await qc.cancelQueries({ queryKey: ['sets-all'] })
      const prevSets = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets'] })
      const prevSetsAll = qc.getQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] })
      const gehoertDazu = (s: LoggedSet) => s.week === week && exerciseIds.includes(s.exercise_id)
      qc.setQueriesData<LoggedSet[]>({ queryKey: ['sets'] }, old => (old ?? []).filter(s => !gehoertDazu(s)))
      qc.setQueriesData<LoggedSet[]>({ queryKey: ['sets-all'] }, old => (old ?? []).filter(s => !gehoertDazu(s)))
      return { prevSets, prevSetsAll } satisfies SetsContext
    },
    onError: (_err, _v, ctx) => rollbackSets(qc, ctx as SetsContext | undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
    },
  })
}
