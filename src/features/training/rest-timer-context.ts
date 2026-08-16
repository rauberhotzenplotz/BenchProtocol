import { createContext, useContext } from 'react'

export interface RestTimerState {
  /** null = kein Timer aktiv. */
  label: string | null
  totalSeconds: number
  /** Kann negativ werden — die Pause zählt über 0 hinaus weiter, statt
      sich nach ein paar Sekunden von selbst abzuräumen (siehe
      RestTimerProvider). */
  secondsLeft: number
  start: (seconds: number, label: string) => void
  stop: () => void
  addSeconds: (delta: number) => void
  /** true, solange der Gym-Modus offen ist — die kleine schwebende Leiste
      blendet sich dann aus, weil der Gym-Modus die Pause großflächig
      selbst anzeigt. */
  gymActive: boolean
  setGymActive: (an: boolean) => void
  /** Von der SessionView der laufenden Einheit gesetzt, solange sie
      gemountet ist — damit die schwebende Leiste "zurück in den Gym-Modus"
      anbieten kann, auch wenn man gerade im Trainings-Tab wo anders steht
      (z. B. die Sätze der Einheit ohne Gym-Modus prüft). */
  reopenGym: (() => void) | null
  setReopenGym: (fn: (() => void) | null) => void
}

export const RestTimerContext = createContext<RestTimerState | null>(null)

export function useRestTimer() {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer() nur innerhalb von <RestTimerProvider> verwenden.')
  return ctx
}
