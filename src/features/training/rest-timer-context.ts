import { createContext, useContext } from 'react'

export interface RestTimerState {
  /** null = kein Timer aktiv. */
  label: string | null
  totalSeconds: number
  secondsLeft: number
  start: (seconds: number, label: string) => void
  stop: () => void
  addSeconds: (delta: number) => void
}

export const RestTimerContext = createContext<RestTimerState | null>(null)

export function useRestTimer() {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer() nur innerhalb von <RestTimerProvider> verwenden.')
  return ctx
}
