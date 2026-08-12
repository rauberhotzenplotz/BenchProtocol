import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { RpeBlock, RpeBlockStatus, RpePlannedSet } from '../../types/db'
import type { GeplanteWoche } from './blockPlanung'

export function useBlocksForExercises(exerciseIds: string[]) {
  return useQuery({
    queryKey: ['rpe-blocks', [...exerciseIds].sort()],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rpe_blocks')
        .select('*')
        .in('exercise_id', exerciseIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as RpeBlock[]
    },
  })
}

export function usePlannedSets(blockId: string | undefined) {
  return useQuery({
    queryKey: ['rpe-planned-sets', blockId],
    enabled: !!blockId,
    queryFn: async () => {
      const { data, error } = await supabase.from('rpe_planned_sets').select('*').eq('block_id', blockId!).order('week_number')
      if (error) throw error
      return data as RpePlannedSet[]
    },
  })
}

function invalidateBlocks(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['rpe-blocks'] })
}

/** Legt einen Block plus seine Wochenplanung in einem Rutsch an. Die
    Zielgewichte pro Woche werden hier übergeben (nicht neu berechnet) —
    der Aufrufer entscheidet, ob/welches Start-e1RM zur Rückrechnung
    vorliegt (siehe RpeBlockPage: leer bei allererstem Block). */
export function useCreateBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      exerciseId,
      plannedWeeks,
      plate,
      wochen,
    }: {
      exerciseId: string
      plannedWeeks: number
      plate: number
      wochen: GeplanteWoche[]
    }) => {
      const { data: block, error: blockErr } = await supabase
        .from('rpe_blocks')
        .insert({ exercise_id: exerciseId, planned_weeks: plannedWeeks, plate })
        .select()
        .single()
      if (blockErr) throw blockErr

      const { error: setsErr } = await supabase.from('rpe_planned_sets').insert(
        wochen.map(w => ({
          block_id: block.id,
          week_number: w.weekNumber,
          target_reps: w.targetReps,
          target_rpe: w.targetRpe,
          target_weight: w.targetWeight,
        })),
      )
      if (setsErr) throw setsErr

      return block as RpeBlock
    },
    onSuccess: () => invalidateBlocks(qc),
  })
}

/** Trägt den tatsächlichen Top-Satz einer Woche ein. */
export function useLogWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      gewicht,
      wdh,
      rpe,
    }: {
      id: string
      gewicht: number
      wdh: number
      rpe: number
    }) => {
      const { error } = await supabase
        .from('rpe_planned_sets')
        .update({ actual_weight: gewicht, actual_reps: wdh, actual_rpe: rpe, logged_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rpe-planned-sets'] }),
  })
}

export function useSetBlockStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RpeBlockStatus }) => {
      const { error } = await supabase.from('rpe_blocks').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBlocks(qc),
  })
}

export function useDeleteBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rpe_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBlocks(qc),
  })
}
