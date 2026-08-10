import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { BenchProgressionRow, BenchSlot } from '../../types/db'

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
