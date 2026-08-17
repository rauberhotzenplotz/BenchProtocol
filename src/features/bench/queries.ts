import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { BenchProgressionRow, BenchSlot, Exercise } from '../../types/db'
import { setsOf } from '../training/calc'
import { naechstesE1rm, round } from './calc'
import { zielgewicht } from '../rpeblock/e1rm'

const DEFAULT_ROWS: Omit<BenchProgressionRow, 'id' | 'plan_id' | 'user_id'>[] = [
  { slot: 'd1', week: 1, scheme: '4 × 5', pct: 0.78, hint: 'RPE 7 — zwei bis drei Wdh. in Reserve' },
  { slot: 'd1', week: 2, scheme: '4 × 5', pct: 0.81, hint: 'RPE 8 — zwei Wdh. in Reserve' },
  { slot: 'd1', week: 3, scheme: '4 × 4', pct: 0.85, hint: 'RPE 8–9 — eine bis zwei Wdh. in Reserve' },
  { slot: 'd1', week: 4, scheme: '3 × 5', pct: 0.62, hint: 'Deload, zügig und locker' },
  { slot: 'd3', week: 1, scheme: '4 × 5', pct: 0.7, hint: 'Pause 1–2 s auf der Brust, ohne Spannung zu verlieren' },
  { slot: 'd3', week: 2, scheme: '4 × 5', pct: 0.72, hint: 'Technik vor Gewicht' },
  { slot: 'd3', week: 3, scheme: '4 × 5', pct: 0.74, hint: 'Technik vor Gewicht' },
  { slot: 'd3', week: 4, scheme: '3 × 5', pct: 0.58, hint: 'Deload' },
]

export function useBenchProgression(planId: string | undefined) {
  return useQuery({
    queryKey: ['bench-progression', planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase.from('bench_progression').select('*').eq('plan_id', planId!)
      if (error) throw error
      let rows = data as BenchProgressionRow[]
      if (rows.length === 0) {
        // Ein neuer Bankfokus-Plan bekommt die generische Standard-
        // Progression — dieselbe Vorbelegung wie SEED.bench in der alten App.
        const { data: eingefuegt, error: insErr } = await supabase
          .from('bench_progression')
          .insert(DEFAULT_ROWS.map(r => ({ ...r, plan_id: planId })))
          .select()
        if (insErr) throw insErr
        rows = eingefuegt as BenchProgressionRow[]
      }
      return rows.sort((a, b) => a.slot.localeCompare(b.slot) || a.week - b.week)
    },
  })
}

export function useUpdateBenchProgressionRow(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pct }: { id: string; pct: number }) => {
      const { error } = await supabase.from('bench_progression').update({ pct }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench-progression', planId] }),
  })
}

export function benchRowsFor(rows: BenchProgressionRow[], slot: BenchSlot) {
  return rows.filter(r => r.slot === slot).sort((a, b) => a.week - b.week)
}

/** Referenz-Wiederholungen/RPE, auf die das neue 1RM nach einem
    automatischen Blockabschluss zurückgerechnet wird (plans.work/reps/rpe
    bilden gemeinsam den "Testsatz", aus dem baseE1RM() das 1RM wieder
    herleitet — siehe bench/calc.ts). */
const REFERENZ_WDH = 5
const REFERENZ_RPE = 8

/** Prüft nach dem Beenden einer Einheit, ob ein Bankfokus-Block automatisch
    abgeschlossen werden kann: nur in der Deload-Woche (4) und nur, wenn
    dort in allen Tagen alle geplanten Sätze abgehakt sind. Lädt dafür
    frisch nach (statt sich auf React-Query-Cache zu verlassen), da das
    direkt nach einer Mutation aufgerufen wird. Kein no-op-Wurf, wenn die
    Bedingung nicht zutrifft — einfach nichts tun.
    Eigenständige Funktion statt reiner mutationFn, weil sie sowohl vom
    useAutoAdvanceBlock-Hook als auch — offline-sicher, also erst nachdem
    endSession serverseitig wirklich bestätigt ist — aus dem in
    src/lib/offlineMutations.ts registrierten onSuccess von endSession
    aufgerufen wird (siehe dort). Braucht zwingend frische Serverdaten, ist
    also selbst nicht offline-fähig/warteschlangentauglich. */
export async function advanceBlockIfDue(qc: QueryClient, planId: string) {
  const { data: plan, error: planErr } = await supabase.from('plans').select('*').eq('id', planId).single()
  if (planErr) throw planErr
  if (plan.typ !== 'bench' || plan.week !== 4) return null

  const { data: days, error: daysErr } = await supabase
    .from('plan_days')
    .select('*, exercises(*)')
    .eq('plan_id', planId)
  if (daysErr) throw daysErr

  const alleExercises = (days as { exercises: Exercise[] }[]).flatMap(d => d.exercises)
  const exerciseIds = alleExercises.map(ex => ex.id)
  if (!exerciseIds.length) return null

  const { data: progression, error: progErr } = await supabase.from('bench_progression').select('*').eq('plan_id', planId)
  if (progErr) throw progErr
  const woche4Rows = (progression as BenchProgressionRow[]).filter(r => r.week === 4)

  const sollFuer = (ex: Exercise) => {
    if (ex.bench_slot) {
      const row = woche4Rows.find(r => r.slot === ex.bench_slot)
      if (row) return setsOf(row.scheme)
    }
    return setsOf(ex.scheme)
  }
  const geplant = alleExercises.reduce((a, ex) => a + sollFuer(ex), 0)

  const { data: woche4Saetze, error: setsErr } = await supabase.from('logged_sets').select('*').in('exercise_id', exerciseIds).eq('week', 4)
  if (setsErr) throw setsErr
  const erledigt = woche4Saetze.filter(s => s.done).length
  if (erledigt < geplant) return null

  const { data: wochen1bis3, error: w13Err } = await supabase
    .from('logged_sets')
    .select('*')
    .in('exercise_id', exerciseIds)
    .lte('week', 3)
  if (w13Err) throw w13Err

  const ergebnis = naechstesE1rm(alleExercises, wochen1bis3)

  const dayIds = (days as { id: string }[]).map(d => d.id)
  await supabase.from('logged_sets').delete().in('exercise_id', exerciseIds).lte('week', 4)
  await supabase.from('sessions').delete().in('day_id', dayIds).lte('week', 4)

  const patch: Record<string, unknown> = {
    block: (plan.block ?? 1) + 1,
    week: 1,
    // Ohne den Reset hier bliebe der alte Zeitstempel stehen — die
    // Wochenautomatik (wochenAutomatik.ts) sähe eine Woche 1, die
    // angeblich schon seit dem vorigen Block läuft, und schaltete
    // sofort wieder weiter, statt dem neuen Block seine volle Woche
    // zu geben.
    week_started_at: new Date().toISOString(),
    last_delta_note: ergebnis.begruendung,
  }
  if (ergebnis.neuesE1rm != null) {
    patch.reps = REFERENZ_WDH
    patch.rpe = REFERENZ_RPE
    patch.work = round(zielgewicht(ergebnis.neuesE1rm, REFERENZ_WDH, REFERENZ_RPE, plan.plate ?? 2.5) ?? plan.work ?? 0)
    // Ohne "Ausgangsdaten"-Tab ist das die einzige Stelle, die beruehrt
    // je setzt — ohne sie bliebe ein ohne Testsatz angelegter Plan für
    // immer als "Beispielwerte" markiert, auch nachdem der erste Block
    // echte, gemessene Zahlen geliefert hat.
    patch.beruehrt = true
  }
  const { error: updateErr } = await supabase.from('plans').update(patch).eq('id', planId)
  if (updateErr) throw updateErr

  qc.invalidateQueries({ queryKey: ['plans'] })
  qc.invalidateQueries({ queryKey: ['sets'] })
  qc.invalidateQueries({ queryKey: ['sets-all'] })
  qc.invalidateQueries({ queryKey: ['session'] })
  qc.invalidateQueries({ queryKey: ['sessions'] })
  qc.invalidateQueries({ queryKey: ['sessions-all'] })

  return ergebnis
}

export function useAutoAdvanceBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => advanceBlockIfDue(qc, planId),
  })
}
