import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { PlanAnlegen } from '../../lib/offline/plans'
import type { Plan } from '../../types/db'

/** RLS filtert serverseitig ohnehin auf auth.uid() = user_id — die Abfragen
    hier brauchen deshalb kein zusätzliches .eq('user_id', ...). Das ist der
    eigentliche Sinn von RLS: der Client muss die Grenze nicht selbst kennen. */
export function usePlans() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['plans', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order')
      if (error) throw error
      return data as Plan[]
    },
  })
}

// Verhalten (mutationFn, optimistische Cache-Updates, Rollback) steht
// zentral in src/lib/offline/plans.ts — nur so überlebt eine offline
// pausierte Mutation einen App-Neustart. Die Hooks tragen nur den Schlüssel.
export function useCreatePlan() {
  return useMutation<void, Error, PlanAnlegen>({ mutationKey: MUTATION_KEYS.createPlan })
}

export function useUpdatePlan() {
  return useMutation<void, Error, { id: string; patch: Partial<Plan> }>({ mutationKey: MUTATION_KEYS.updatePlan })
}

export function useDeletePlan() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deletePlan })
}
