import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from '../training/queries'

/** Tatsächlich abgehakte Sätze dieser Woche, gruppiert nach Muskelgruppe
    und Trainingstag — aus echten geloggten Sätzen (LoggedSet.done), nicht
    aus einer von Hand gepflegten Zahl. Übungen ohne Muskelgruppen-
    Zuordnung tauchen hier gar nicht auf. */
export function istSaetzeJeGruppeUndTag(
  days: DayWithExercises[],
  setsByExercise: Map<string, LoggedSet[]>,
): Map<string, Map<string, number>> {
  const tabelle = new Map<string, Map<string, number>>()
  for (const tag of days) {
    for (const ex of tag.exercises) {
      if (!ex.muscle_group) continue
      const erledigt = (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length
      if (erledigt === 0) continue
      const proTag = tabelle.get(ex.muscle_group) ?? new Map<string, number>()
      proTag.set(tag.id, (proTag.get(tag.id) ?? 0) + erledigt)
      tabelle.set(ex.muscle_group, proTag)
    }
  }
  return tabelle
}

export function istGesamt(proTag: Map<string, number> | undefined): number {
  return proTag ? [...proTag.values()].reduce((a, n) => a + n, 0) : 0
}

/** Summe aller abgehakten Sätze über alle mit einer Muskelgruppe
    verknüpften Übungen dieser Woche — Grundlage der Wochenvolumen-Kachel
    im Cockpit. */
export function gesamtWochenVolumen(days: DayWithExercises[], setsByExercise: Map<string, LoggedSet[]>): number {
  let summe = 0
  for (const tag of days) {
    for (const ex of tag.exercises) {
      if (!ex.muscle_group) continue
      summe += (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length
    }
  }
  return summe
}
