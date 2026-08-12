import { zielgewicht } from './e1rm'

export interface GeplanteWoche {
  weekNumber: number
  targetReps: number
  targetRpe: number
  targetWeight: number | null
}

/** Wochenplanung für einen neuen Block: gleiche Zielwiederholungen in
    jeder Woche, RPE steigt linear von startRpe um rpeSchritt je Woche
    (gedeckelt bei 10, auf 0,5 gerundet). Zielgewicht wird aus startE1rm
    zurückgerechnet, falls vorhanden — ohne bekanntes 1RM (z. B. der
    allererste Block einer Übung) bleiben die Zielgewichte leer, die
    tatsächliche Leistung lässt sich trotzdem wöchentlich eintragen. */
export function planeWochen(opts: {
  plannedWeeks: number
  targetReps: number
  startRpe: number
  rpeSchritt: number
  plate: number
  startE1rm: number | null
}): GeplanteWoche[] {
  const { plannedWeeks, targetReps, startRpe, rpeSchritt, plate, startE1rm } = opts
  return Array.from({ length: plannedWeeks }, (_, i) => {
    const targetRpe = Math.min(10, Math.round((startRpe + i * rpeSchritt) * 2) / 2)
    return {
      weekNumber: i + 1,
      targetReps,
      targetRpe,
      targetWeight: startE1rm != null ? zielgewicht(startE1rm, targetReps, targetRpe, plate) : null,
    }
  })
}
