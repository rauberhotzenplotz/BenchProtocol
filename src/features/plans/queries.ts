import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import type { Plan, PlanTyp } from '../../types/db'

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

export function useCreatePlan() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      typ,
      testsatz,
    }: {
      name: string
      typ: PlanTyp
      /** Optionaler Testsatz für ein genaues Start-1RM über die RPE-Tabelle
          (siehe bench/calc.ts baseE1RM) — ohne Angabe die bisherigen
          Platzhalterwerte, die der Nutzer später im Bank-Tab nachträgt. */
      testsatz?: { work: number; reps: number; rpe: number }
    }) => {
      const gueltigerTestsatz = testsatz && testsatz.work > 0 && testsatz.reps > 0 && testsatz.rpe >= 6 && testsatz.rpe <= 10
      const bench =
        typ === 'bench'
          ? gueltigerTestsatz
            ? { work: testsatz.work, reps: testsatz.reps, rpe: testsatz.rpe, plate: 2.5, block: 1, beruehrt: true }
            : { work: 60, reps: 6, rir: 2, plate: 2.5, block: 1 }
          : {}
      const { data, error } = await supabase
        .from('plans')
        .insert({ name, typ, ...bench })
        .select()
        .single()
      if (error) throw error
      return data as Plan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', user?.id] }),
  })
}

export function useUpdatePlan() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Plan> }) => {
      const { data, error } = await supabase.from('plans').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Plan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', user?.id] }),
  })
}

export function useDeletePlan() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', user?.id] }),
  })
}
