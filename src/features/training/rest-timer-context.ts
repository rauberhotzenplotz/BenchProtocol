import { createContext, useContext } from 'react'

/** Alles an der Satzpause, was sich *nicht* im Sekundentakt aendert.

    Die Trennung ist kein Stilmittel, sondern der Grund, warum die App
    waehrend einer Pause fluessig bleibt. Vorher lag `secondsLeft` mit in
    diesem Context, und der Provider sitzt ueber dem gesamten Baum. Jeder
    Tick schrieb also einen neuen Context-Wert, und damit rannte ein
    Render durch alles darunter: die geoeffnete Seite, im Gym-Modus die
    ganze Uebungstabelle, in der Tagesansicht jede einzelne Satzzeile
    (SetRow ruft useRestTimer, um beim Abhaken die Pause zu starten).
    Gebraucht wird die Zahl aber nur dort, wo sie auch steht -- im Ring
    und in der Ziffernanzeige. */
export interface RestTimerState {
  /** null = kein Timer aktiv. */
  label: string | null
  totalSeconds: number
  /** Die Pause ist durch, zaehlt aber weiter (siehe RestTimerProvider).
      Bewusst ein Schalter und keine Zahl: So merkt eine Komponente, die
      nur "laeuft noch oder nicht" wissen will, genau zwei Aenderungen pro
      Pause statt einer pro Sekunde. */
  abgelaufen: boolean
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

/** Nur der Sekundenstand. Eigener Context, damit ein Tick ausschliesslich
    die Komponenten anfasst, die die Zahl wirklich anzeigen. */
export const RestSekundenContext = createContext<number>(0)

export function useRestTimer() {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer() nur innerhalb von <RestTimerProvider> verwenden.')
  return ctx
}

/** Kann negativ werden — die Pause zählt über 0 hinaus weiter, statt sich
    nach ein paar Sekunden von selbst abzuräumen (siehe
    RestTimerProvider). Wer das nur braucht, um "laeuft noch?" zu
    beantworten, nimmt stattdessen `abgelaufen` aus useRestTimer(). */
export function useRestSekunden(): number {
  return useContext(RestSekundenContext)
}
