import { useEffect, useState, type ReactNode } from 'react'
import { usePlans } from './queries'
import { ActivePlanCtx } from './active-plan-context'
import type { Plan } from '../../types/db'

const STORE_KEY = 'benchProtocol.activePlanId'

function waehleAktiven(plans: Plan[] | undefined, isLoading: boolean, activeId: string | null): Plan | null | undefined {
  if (isLoading || !plans) return undefined
  if (!plans.length) return null
  // Fällt auf den ersten Plan zurück, wenn nichts gewählt ist oder der
  // gewählte Plan nicht mehr existiert (z. B. gelöscht) — Pendant zu
  // aktuellerPlan() aus der alten App.
  return plans.find(p => p.id === activeId) ?? plans[0]
}

export function ActivePlanProvider({ children }: { children: ReactNode }) {
  const { data: plans, isLoading } = usePlans()
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(STORE_KEY))

  useEffect(() => {
    if (activeId) localStorage.setItem(STORE_KEY, activeId)
  }, [activeId])

  return (
    <ActivePlanCtx.Provider
      value={{
        plans: plans ?? [],
        activePlan: waehleAktiven(plans, isLoading, activeId),
        setActivePlanId: setActiveId,
        loading: isLoading,
      }}
    >
      {children}
    </ActivePlanCtx.Provider>
  )
}
