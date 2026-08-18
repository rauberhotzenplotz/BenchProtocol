import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { VolumenZeileAnlegen } from '../../lib/offline/volume'
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

// Verhalten zentral in src/lib/offline/volume.ts.
export function useCreateVolumeRow() {
  return useMutation<void, Error, VolumenZeileAnlegen>({ mutationKey: MUTATION_KEYS.createVolumeRow })
}

export function useUpdateVolumeRow() {
  return useMutation<void, Error, { id: string; patch: Partial<VolumeRow> }>({ mutationKey: MUTATION_KEYS.updateVolumeRow })
}

export function useDeleteVolumeRow() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteVolumeRow })
}

export function volumeVerdict(total: number): { klasse: string; text: string } {
  if (total === 0) return { klasse: 'mute', text: 'kein Volumen' }
  if (total < 8) return { klasse: 'low', text: 'unter Zielband' }
  if (total <= 20) return { klasse: 'ok', text: 'im Zielband' }
  return { klasse: 'high', text: 'über Zielband' }
}
