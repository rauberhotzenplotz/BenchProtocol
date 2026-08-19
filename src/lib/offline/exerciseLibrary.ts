import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { ExerciseLibraryEntry } from '../../types/db'
import { MUTATION_KEYS, SYNC_SCOPE } from './keys'
import { optimistisch, zurueckrollen, inListeAnhaengen, inListeErsetzen, ausListeEntfernen, type Schnappschuss } from './cache'

export type BibliothekseintragAnlegen = Pick<ExerciseLibraryEntry, 'id' | 'name' | 'scheme' | 'rest' | 'sort_order'>

/** Verhalten der Übungsbibliothek — dasselbe Drei-Mutationen-Muster wie
    lib/offline/volume.ts. Nicht an einen Plan gebunden (kein plan_id),
    deshalb reicht hier ein einzelner fester Cache-Schlüssel statt eines
    Präfix-Filters. */
export function registriereBibliothekMutationen(qc: QueryClient) {
  const filter = { queryKey: ['exercise-library'] }
  const invalidieren = () => qc.invalidateQueries(filter)

  qc.setMutationDefaults<void, Error, BibliothekseintragAnlegen>(MUTATION_KEYS.createLibraryEntry, {
    scope: SYNC_SCOPE,
    mutationFn: async row => {
      const { error } = await supabase.from('exercise_library').insert(row)
      if (error) throw error
    },
    onMutate: row => {
      // Von Hand angelegte Vorlagen (die einzige Quelle dieser Mutation)
      // haben nie Katalogdaten — die Felder aus dem Excel-Import bleiben
      // hier konsequent leer, bis invalidateQueries() die echte Zeile holt.
      const neu: ExerciseLibraryEntry = {
        ...row,
        user_id: '',
        created_at: new Date().toISOString(),
        bench_slot: null,
        name_en: null,
        name_de_raw: null,
        difficulty: null,
        muscle_group: null,
        primary_muscle: null,
        secondary_muscle: null,
        tertiary_muscle: null,
        equipment: null,
        body_position: null,
        hand_pattern: null,
        arm_pattern: null,
        grip: null,
        leg_pattern: null,
        body_region: null,
        mechanic: null,
        laterality: null,
      }
      return optimistisch<ExerciseLibraryEntry>(qc, filter, alt => inListeAnhaengen(alt, neu))
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })

  qc.setMutationDefaults<void, Error, { id: string; patch: Partial<ExerciseLibraryEntry> }>(MUTATION_KEYS.updateLibraryEntry, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('exercise_library').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) => optimistisch<ExerciseLibraryEntry>(qc, filter, alt => inListeErsetzen(alt, id, patch)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })

  qc.setMutationDefaults<void, Error, string>(MUTATION_KEYS.deleteLibraryEntry, {
    scope: SYNC_SCOPE,
    mutationFn: async id => {
      const { error } = await supabase.from('exercise_library').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: id => optimistisch<ExerciseLibraryEntry>(qc, filter, alt => ausListeEntfernen(alt, id)),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: invalidieren,
  })
}
