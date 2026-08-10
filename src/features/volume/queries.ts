import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { VolumeRow } from '../../types/db'

export function useVolumeRows(planId: string | undefined) {
  return useQuery({
    queryKey: ['volume-rows', planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase.from('volume_rows').select('*').eq('plan_id', planId!).order('sort_order')
      if (error) throw error
      return data as VolumeRow[]
    },
  })
}

export function useCreateVolumeRow(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ muscleGroup, sortOrder }: { muscleGroup: string; sortOrder: number }) => {
      const { data, error } = await supabase
        .from('volume_rows')
        .insert({ plan_id: planId, muscle_group: muscleGroup, sort_order: sortOrder })
        .select()
        .single()
      if (error) throw error
      return data as VolumeRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volume-rows', planId] }),
  })
}

export function useUpdateVolumeRow(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VolumeRow> }) => {
      const { error } = await supabase.from('volume_rows').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volume-rows', planId] }),
  })
}

export function useDeleteVolumeRow(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('volume_rows').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volume-rows', planId] }),
  })
}

export function totalSetsOf(row: VolumeRow): number {
  return Object.values(row.sets_by_day).reduce((a, n) => a + (n || 0), 0)
}

export function volumeVerdict(total: number): { klasse: string; text: string } {
  if (total === 0) return { klasse: 'mute', text: 'kein Volumen' }
  if (total < 8) return { klasse: 'low', text: 'unter Zielband' }
  if (total <= 20) return { klasse: 'ok', text: 'im Zielband' }
  return { klasse: 'high', text: 'über Zielband' }
}
