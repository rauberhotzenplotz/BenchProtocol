import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { BlockAnlegen } from '../../lib/offline/rpeblock'
import type { RpeBlock, RpeBlockStatus, RpePlannedSet } from '../../types/db'

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

// Verhalten zentral in src/lib/offline/rpeblock.ts.

/** Legt einen Block plus seine Wochenplanung in einem Rutsch an. Die
    Zielgewichte pro Woche werden hier übergeben (nicht neu berechnet) —
    der Aufrufer entscheidet, ob/welches Start-e1RM zur Rückrechnung
    vorliegt (siehe RpeBlockPage: leer bei allererstem Block). */
export function useCreateBlock() {
  return useMutation<void, Error, BlockAnlegen>({ mutationKey: MUTATION_KEYS.createBlock })
}

/** Trägt den tatsächlichen Top-Satz einer Woche ein. */
export function useLogWeek() {
  return useMutation<void, Error, { id: string; blockId: string; gewicht: number; wdh: number; rpe: number }>({
    mutationKey: MUTATION_KEYS.logWeek,
  })
}

export function useSetBlockStatus() {
  return useMutation<void, Error, { id: string; status: RpeBlockStatus }>({ mutationKey: MUTATION_KEYS.setBlockStatus })
}

export function useDeleteBlock() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteBlock })
}
