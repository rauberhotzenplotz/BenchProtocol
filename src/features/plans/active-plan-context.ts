import { createContext, useContext } from 'react'
import type { Plan } from '../../types/db'

export interface ActivePlanState {
  plans: Plan[]
  /** undefined = lädt noch, null = keine Pläne vorhanden. */
  activePlan: Plan | null | undefined
  setActivePlanId: (id: string) => void
  loading: boolean
}

export const ActivePlanCtx = createContext<ActivePlanState | null>(null)

export function useActivePlan() {
  const ctx = useContext(ActivePlanCtx)
  if (!ctx) throw new Error('useActivePlan() nur innerhalb von <ActivePlanProvider> verwenden.')
  return ctx
}
