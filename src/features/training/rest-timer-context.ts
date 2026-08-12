import { createContext, useContext } from 'react'

export interface RestTimerState {
  /** null = kein Timer aktiv. */
  label: string | null
  totalSeconds: number
  secondsLeft: number
  start: (seconds: number, label: string) => void
  stop: () => void
  addSeconds: (delta: number) => void
  /** true, solange der Gym-Modus offen ist — die kleine schwebende Leiste
      blendet sich dann aus, weil der Gym-Modus die Pause großflächig
      selbst anzeigt. */
  gymActive: boolean
  setGymActive: (an: boolean) => void
}

export const RestTimerContext = createContext<RestTimerState | null>(null)

export function useRestTimer() {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer() nur innerhalb von <RestTimerProvider> verwenden.')
  return ctx
}
