import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { BibliothekseintragAnlegen } from '../../lib/offline/exerciseLibrary'
import type { ExerciseLibraryEntry } from '../../types/db'

/** Nicht an einen Plan gebunden — eine Bibliothek je Nutzer, quer über
    alle Pläne nutzbar (dieselbe Übung taucht oft in mehreren Plänen auf). */
export function useExerciseLibrary() {
  return useQuery({
    queryKey: ['exercise-library'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_library').select('*').order('sort_order')
      if (error) throw error
      return data as ExerciseLibraryEntry[]
    },
  })
}

// Verhalten zentral in src/lib/offline/exerciseLibrary.ts.
export function useCreateLibraryEntry() {
  return useMutation<void, Error, BibliothekseintragAnlegen>({ mutationKey: MUTATION_KEYS.createLibraryEntry })
}

export function useUpdateLibraryEntry() {
  return useMutation<void, Error, { id: string; patch: Partial<ExerciseLibraryEntry> }>({ mutationKey: MUTATION_KEYS.updateLibraryEntry })
}

export function useDeleteLibraryEntry() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteLibraryEntry })
}
