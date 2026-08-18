import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Plan, PlanTyp, BenchProgressionRow } from '../../types/db'
import { DEFAULT_BENCH_ROWS } from '../../features/bench/queries'
import { MUTATION_KEYS, SYNC_SCOPE, neueId } from './keys'
import { optimistisch, zurueckrollen, inListeAnhaengen, inListeErsetzen, ausListeEntfernen, type Schnappschuss } from './cache'

export interface PlanAnlegen {
  /** Vom Aufrufer erzeugt, damit er sofort damit weiterarbeiten kann
      (z. B. den Plan aktiv setzen), ohne auf den Server zu warten. */
  id: string
  name: string
  typ: PlanTyp
  /** Optionaler Testsatz für ein genaues Start-1RM über die RPE-Tabelle
      (siehe bench/calc.ts baseE1RM) — ohne Angabe Platzhalterwerte, die
      der Nutzer später im Bank-Tab nachträgt. */
  testsatz?: { work: number; reps: number; rpe: number }
}

/** Die Bank-Felder eines neuen Plans — identisch zur früheren Fassung in
    plans/queries.ts, nur an einer Stelle statt zweimal. */
function benchFelder(typ: PlanTyp, testsatz: PlanAnlegen['testsatz']) {
  if (typ !== 'bench') return {}
  const gueltig = testsatz && testsatz.work > 0 && testsatz.reps > 0 && testsatz.rpe >= 6 && testsatz.rpe <= 10
  return gueltig
    ? { work: testsatz.work, reps: testsatz.reps, rpe: testsatz.rpe, plate: 2.5, block: 1, beruehrt: true }
    : { work: 60, reps: 6, rir: 2, plate: 2.5, block: 1 }
}

/** Vollständiger Plan für den Cache, solange der Server noch nichts
    gesehen hat. Die Vorbelegungen entsprechen den Spalten-Defaults aus
    supabase/migrations/0001_init.sql. */
function optimistischerPlan({ id, name, typ, testsatz }: PlanAnlegen): Plan {
  const jetzt = new Date().toISOString()
  return {
    id,
    user_id: '',
    name,
    typ,
    week: 1,
    week_started_at: jetzt,
    sort_order: 0,
    work: null,
    reps: null,
    rir: null,
    plate: null,
    block: null,
    goal: null,
    goal_from: null,
    beruehrt: false,
    rpe: null,
    last_delta_note: null,
    created_at: jetzt,
    updated_at: jetzt,
    ...benchFelder(typ, testsatz),
  }
}

export function registrierePlanMutationen(qc: QueryClient) {
  // Der Schlüssel der Planliste trägt die Nutzer-ID (['plans', userId]).
  // Hier wird deshalb über den Präfix gefiltert statt über den exakten
  // Schlüssel — die ID ist an dieser Stelle nicht bekannt und wird auch
  // nicht gebraucht.
  const planFilter = { queryKey: ['plans'] }

  qc.setMutationDefaults<void, Error, PlanAnlegen>(MUTATION_KEYS.createPlan, {
    scope: SYNC_SCOPE,
    mutationFn: async (eingabe: PlanAnlegen) => {
      const { error } = await supabase
        .from('plans')
        .insert({ id: eingabe.id, name: eingabe.name, typ: eingabe.typ, ...benchFelder(eingabe.typ, eingabe.testsatz) })
      if (error) throw error

      // Die Standard-Progression gehört zum Plan: ohne sie wäre ein
      // offline angelegter Bankplan bis zur nächsten Onlinephase leer.
      if (eingabe.typ === 'bench') {
        const { error: progErr } = await supabase
          .from('bench_progression')
          .insert(DEFAULT_BENCH_ROWS.map(r => ({ ...r, id: neueId(), plan_id: eingabe.id })))
        if (progErr) throw progErr
      }
    },
    onMutate: async (eingabe: PlanAnlegen) => {
      const plan = optimistischerPlan(eingabe)
      const schnappschuss = await optimistisch<Plan>(qc, planFilter, alt => inListeAnhaengen(alt, plan))

      // Ohne diesen Seed bleibt useDays(planId) offline für immer im
      // Ladezustand (kein Cache-Eintrag, networkMode 'online' pausiert die
      // Abfrage) — Cockpit/Training zeigen dann dauerhaft nichts an, obwohl
      // der Plan selbst schon da ist. Ein frischer Plan hat noch keine Tage.
      qc.setQueryData(['days', plan.id], [])

      if (eingabe.typ === 'bench') {
        qc.setQueryData<BenchProgressionRow[]>(
          ['bench-progression', eingabe.id],
          DEFAULT_BENCH_ROWS.map(r => ({ ...r, id: neueId(), plan_id: eingabe.id, user_id: '' })),
        )
      }
      return schnappschuss
    },
    onError: (_e: unknown, _v: PlanAnlegen, ctx: unknown) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => {
      qc.invalidateQueries(planFilter)
      qc.invalidateQueries({ queryKey: ['bench-progression'] })
    },
  })

  qc.setMutationDefaults<void, Error, { id: string; patch: Partial<Plan> }>(MUTATION_KEYS.updatePlan, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('plans').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) => optimistisch<Plan>(qc, planFilter, alt => inListeErsetzen(alt, id, patch)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(planFilter),
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deletePlan, {
    scope: SYNC_SCOPE,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id: string) => {
      const schnappschuss = await optimistisch<Plan>(qc, planFilter, alt => ausListeEntfernen(alt, id))
      // Die Datenbank räumt die Kindsätze per ON DELETE CASCADE weg; lokal
      // müssen die zugehörigen Caches mit verschwinden, sonst zeigt die
      // Oberfläche die Tage eines gelöschten Plans weiter an.
      qc.removeQueries({ queryKey: ['days', id] })
      qc.removeQueries({ queryKey: ['volume-rows', id] })
      qc.removeQueries({ queryKey: ['bench-progression', id] })
      return schnappschuss
    },
    onError: (_e: unknown, _v: string, ctx: unknown) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(planFilter),
  })
}
