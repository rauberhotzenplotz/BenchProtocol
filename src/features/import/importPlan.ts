import type { ParsedWorkbook } from './xlsxParse'
import type { PlanTyp, Plan, PlanDay, Exercise, BenchProgressionRow, VolumeRow } from '../../types/db'
import type { ImportDaten } from '../../lib/offline/bulk'
import { neueId } from '../../lib/offline/keys'

const STANDARD_HINWEISE: Record<'d1' | 'd3', string[]> = {
  d1: ['RPE 7 — zwei bis drei Wdh. in Reserve', 'RPE 8 — zwei Wdh. in Reserve', 'RPE 8–9 — eine bis zwei Wdh. in Reserve', 'Deload, zügig und locker'],
  d3: ['Technik vor Gewicht', 'Technik vor Gewicht', 'Technik vor Gewicht', 'Deload'],
}

/** Baut aus einer eingelesenen Arbeitsmappe alle Zeilen eines neuen Plans —
    rein rechnend, ohne Netzzugriff. Alle IDs entstehen hier clientseitig,
    damit Tage und Übungen sofort aufeinander verweisen können und der
    Import auch offline vollständig ist; geschrieben wird später als eine
    Mutation (siehe lib/offline/bulk.ts). */
export function baueImportZeilen(parsed: ParsedWorkbook, name: string, typ: PlanTyp): ImportDaten {
  const jetzt = new Date().toISOString()
  const planId = neueId()

  const bench =
    typ === 'bench' && parsed.bench
      ? {
          work: parsed.bench.work ?? 60,
          reps: parsed.bench.reps ?? 6,
          rir: parsed.bench.rir ?? 2,
          plate: parsed.bench.plate ?? 2.5,
        }
      : {}

  const plan: Plan = {
    id: planId,
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
    block: typ === 'bench' ? 1 : null,
    goal: null,
    goal_from: null,
    beruehrt: false,
    rpe: null,
    last_delta_note: null,
    created_at: jetzt,
    updated_at: jetzt,
    ...bench,
  }

  const tage: PlanDay[] = parsed.days.map((d, i) => ({
    id: neueId(),
    plan_id: planId,
    user_id: '',
    name: d.name,
    sub: null,
    sort_order: i,
  }))

  const uebungen: Exercise[] = parsed.days.flatMap((d, di) =>
    d.exercises.map((ex, ei) => ({
      id: neueId(),
      day_id: tage[di].id,
      user_id: '',
      name: ex.name,
      scheme: ex.scheme || null,
      rest: ex.rest || null,
      note: ex.note || null,
      bench_slot: null,
      muscle_group: null,
      sort_order: ei,
    })),
  )

  const progression: BenchProgressionRow[] =
    typ === 'bench' && parsed.bench && (parsed.bench.d1Pct.length || parsed.bench.d3Pct.length)
      ? (['d1', 'd3'] as const).flatMap(slot => {
          const werte = slot === 'd1' ? parsed.bench!.d1Pct : parsed.bench!.d3Pct
          return werte.map((pct, i) => ({
            id: neueId(),
            plan_id: planId,
            user_id: '',
            slot,
            week: i + 1,
            pct,
            hint: STANDARD_HINWEISE[slot][i] ?? '',
            scheme: i === 3 ? '3 × 5' : '4 × 5',
          }))
        })
      : []

  const volumen: VolumeRow[] = parsed.volume.map((v, i) => ({
    id: neueId(),
    plan_id: planId,
    user_id: '',
    muscle_group: v.muscleGroup,
    note: v.note || null,
    sort_order: i,
    sets_by_day: Object.fromEntries(v.perDay.map((n, di) => [tage[di]?.id, n]).filter(([id]) => id != null)) as Record<string, number>,
  }))

  return { plan, tage, uebungen, progression, volumen }
}
