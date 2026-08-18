import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { RpeBlock, RpeBlockStatus, RpePlannedSet } from '../../types/db'
import type { GeplanteWoche } from '../../features/rpeblock/blockPlanung'
import { MUTATION_KEYS, SYNC_SCOPE, neueId } from './keys'
import { optimistisch, zurueckrollen, inListeErsetzen, ausListeEntfernen, type Schnappschuss } from './cache'

export interface BlockAnlegen {
  id: string
  exerciseId: string
  plannedWeeks: number
  plate: number
  wochen: GeplanteWoche[]
}

/** Die Wochenzeilen eines Blocks — clientseitig erzeugt, damit ein offline
    angelegter Block sofort vollständig im Cache steht und beim Sync mit
    genau denselben IDs beim Server ankommt. */
function geplanteSaetze(blockId: string, wochen: GeplanteWoche[]): RpePlannedSet[] {
  return wochen.map(w => ({
    id: neueId(),
    block_id: blockId,
    user_id: '',
    week_number: w.weekNumber,
    target_reps: w.targetReps,
    target_rpe: w.targetRpe,
    target_weight: w.targetWeight,
    actual_weight: null,
    actual_reps: null,
    actual_rpe: null,
    logged_at: null,
  }))
}

export function registriereRpeBlockMutationen(qc: QueryClient) {
  // Der Blocklisten-Schlüssel trägt ein sortiertes Übungs-ID-Array
  // (['rpe-blocks', ids]); hier reicht der Präfix.
  const blockFilter = { queryKey: ['rpe-blocks'] }

  qc.setMutationDefaults<void, Error, BlockAnlegen>(MUTATION_KEYS.createBlock, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, exerciseId, plannedWeeks, plate, wochen }) => {
      const { error: blockErr } = await supabase
        .from('rpe_blocks')
        .insert({ id, exercise_id: exerciseId, planned_weeks: plannedWeeks, plate })
      if (blockErr) throw blockErr

      const { error: setsErr } = await supabase.from('rpe_planned_sets').insert(
        wochen.map(w => ({
          id: neueId(),
          block_id: id,
          week_number: w.weekNumber,
          target_reps: w.targetReps,
          target_rpe: w.targetRpe,
          target_weight: w.targetWeight,
        })),
      )
      if (setsErr) throw setsErr
    },
    onMutate: async ({ id, exerciseId, plannedWeeks, plate, wochen }) => {
      const jetzt = new Date().toISOString()
      const block: RpeBlock = {
        id,
        exercise_id: exerciseId,
        user_id: '',
        start_date: jetzt.slice(0, 10),
        planned_weeks: plannedWeeks,
        status: 'active',
        plate,
        created_at: jetzt,
      }
      // Neueste zuerst — die Abfrage sortiert absteigend nach created_at.
      const schnappschuss = await optimistisch<RpeBlock>(qc, blockFilter, alt => [block, ...(alt ?? [])])
      qc.setQueryData<RpePlannedSet[]>(['rpe-planned-sets', id], geplanteSaetze(id, wochen))
      return schnappschuss
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => {
      qc.invalidateQueries(blockFilter)
      qc.invalidateQueries({ queryKey: ['rpe-planned-sets'] })
    },
  })

  qc.setMutationDefaults<void, Error, { id: string; blockId: string; gewicht: number; wdh: number; rpe: number }>(
    MUTATION_KEYS.logWeek,
    {
      scope: SYNC_SCOPE,
      mutationFn: async ({ id, gewicht, wdh, rpe }) => {
        const { error } = await supabase
          .from('rpe_planned_sets')
          .update({ actual_weight: gewicht, actual_reps: wdh, actual_rpe: rpe, logged_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      },
      onMutate: ({ id, blockId, gewicht, wdh, rpe }) =>
        optimistisch<RpePlannedSet>(qc, { queryKey: ['rpe-planned-sets', blockId] }, alt =>
          inListeErsetzen(alt, id, {
            actual_weight: gewicht,
            actual_reps: wdh,
            actual_rpe: rpe,
            logged_at: new Date().toISOString(),
          }),
        ),
      onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['rpe-planned-sets'] }),
    },
  )

  qc.setMutationDefaults<void, Error, { id: string; status: RpeBlockStatus }>(MUTATION_KEYS.setBlockStatus, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('rpe_blocks').update({ status }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, status }) => optimistisch<RpeBlock>(qc, blockFilter, alt => inListeErsetzen(alt, id, { status })),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(blockFilter),
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deleteBlock, {
    scope: SYNC_SCOPE,
    mutationFn: async id => {
      const { error } = await supabase.from('rpe_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async id => {
      const schnappschuss = await optimistisch<RpeBlock>(qc, blockFilter, alt => ausListeEntfernen(alt, id))
      // Wochenzeilen hängen per ON DELETE CASCADE am Block — lokal
      // entsprechend mit entfernen.
      qc.removeQueries({ queryKey: ['rpe-planned-sets', id] })
      return schnappschuss
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(blockFilter),
  })
}
