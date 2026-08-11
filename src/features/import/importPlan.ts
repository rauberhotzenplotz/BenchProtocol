import { supabase } from '../../lib/supabase'
import type { ParsedWorkbook } from './xlsxParse'
import type { Plan, PlanTyp } from '../../types/db'

const STANDARD_HINWEISE: Record<'d1' | 'd3', string[]> = {
  d1: ['RPE 7 — zwei bis drei Wdh. in Reserve', 'RPE 8 — zwei Wdh. in Reserve', 'RPE 8–9 — eine bis zwei Wdh. in Reserve', 'Deload, zügig und locker'],
  d3: ['Technik vor Gewicht', 'Technik vor Gewicht', 'Technik vor Gewicht', 'Deload'],
}

/** Reihenfolge wegen Fremdschlüsseln: Plan → Tage → Übungen, dann die
    beiden optionalen Blätter (Bank-Progression, Volumen), die auf die
    eben angelegten Tage verweisen. */
export async function importAlsNeuerPlan(parsed: ParsedWorkbook, name: string, typ: PlanTyp): Promise<Plan> {
  const planPatch =
    typ === 'bench' && parsed.bench
      ? {
          work: parsed.bench.work ?? 60,
          reps: parsed.bench.reps ?? 6,
          rir: parsed.bench.rir ?? 2,
          plate: parsed.bench.plate ?? 2.5,
        }
      : {}

  const { data: plan, error: planErr } = await supabase.from('plans').insert({ name, typ, ...planPatch }).select().single()
  if (planErr) throw planErr

  const { data: days, error: daysErr } = await supabase
    .from('plan_days')
    .insert(parsed.days.map((d, i) => ({ plan_id: plan.id, name: d.name, sort_order: i })))
    .select()
  if (daysErr) throw daysErr

  const exerciseRows = parsed.days.flatMap((d, di) =>
    d.exercises.map((ex, ei) => ({
      day_id: days[di].id,
      name: ex.name,
      scheme: ex.scheme || null,
      rest: ex.rest || null,
      note: ex.note || null,
      sort_order: ei,
    })),
  )
  if (exerciseRows.length) {
    const { error } = await supabase.from('exercises').insert(exerciseRows)
    if (error) throw error
  }

  if (typ === 'bench' && parsed.bench && (parsed.bench.d1Pct.length || parsed.bench.d3Pct.length)) {
    const progressionRows = (['d1', 'd3'] as const).flatMap(slot => {
      const werte = slot === 'd1' ? parsed.bench!.d1Pct : parsed.bench!.d3Pct
      return werte.map((pct, i) => ({
        plan_id: plan.id,
        slot,
        week: i + 1,
        pct,
        hint: STANDARD_HINWEISE[slot][i] ?? '',
        scheme: i === 3 ? '3 × 5' : '4 × 5',
      }))
    })
    if (progressionRows.length) {
      const { error } = await supabase.from('bench_progression').insert(progressionRows)
      if (error) throw error
    }
  }

  if (parsed.volume.length) {
    const volumeRows = parsed.volume.map((v, i) => ({
      plan_id: plan.id,
      muscle_group: v.muscleGroup,
      note: v.note || null,
      sort_order: i,
      sets_by_day: Object.fromEntries(v.perDay.map((n, di) => [days[di]?.id, n]).filter(([id]) => id != null)),
    }))
    const { error } = await supabase.from('volume_rows').insert(volumeRows)
    if (error) throw error
  }

  return plan as Plan
}
