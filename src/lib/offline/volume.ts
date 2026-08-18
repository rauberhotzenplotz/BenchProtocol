import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { VolumeRow } from '../../types/db'
import { MUTATION_KEYS, SYNC_SCOPE } from './keys'
import { optimistisch, zurueckrollen, inListeAnhaengen, inListeErsetzen, ausListeEntfernen, type Schnappschuss } from './cache'

export type VolumenZeileAnlegen = Pick<VolumeRow, 'id' | 'plan_id' | 'muscle_group' | 'sort_order'>

export function registriereVolumenMutationen(qc: QueryClient) {
  // Wie bei den Tagen über den Präfix statt über die konkrete planId — die
  // Zeile bringt ihr plan_id selbst mit.
  const filter = { queryKey: ['volume-rows'] }
  const invalidieren = () => qc.invalidateQueries(filter)

  qc.setMutationDefaults<void, Error, VolumenZeileAnlegen>(MUTATION_KEYS.createVolumeRow, {
    scope: SYNC_SCOPE,
    mutationFn: async row => {
      const { error } = await supabase.from('volume_rows').insert(row)
      if (error) throw error
    },
    onMutate: row => {
      const neu: VolumeRow = { ...row, user_id: '', sets_by_day: {}, note: null }
      return optimistisch<VolumeRow>(qc, filter, alt =>
        alt?.[0] && alt[0].plan_id !== row.plan_id ? alt : inListeAnhaengen(alt, neu),
      )
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })

  qc.setMutationDefaults<void, Error, { id: string; patch: Partial<VolumeRow> }>(MUTATION_KEYS.updateVolumeRow, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('volume_rows').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) => optimistisch<VolumeRow>(qc, filter, alt => inListeErsetzen(alt, id, patch)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deleteVolumeRow, {
    scope: SYNC_SCOPE,
    mutationFn: async id => {
      const { error } = await supabase.from('volume_rows').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: id => optimistisch<VolumeRow>(qc, filter, alt => ausListeEntfernen(alt, id)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })
}
