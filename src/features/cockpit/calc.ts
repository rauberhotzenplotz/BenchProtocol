import type { DayWithExercises } from '../training/queries'
import { tagFortschritt, tonnageOf, gruppeSetsByExercise, type TagFortschritt } from '../training/calc'
import { tagFarbe } from '../training/dayColor'
import type { LoggedSet, TrainingSession } from '../../types/db'

export function naechsterTag(days: DayWithExercises[], setsByExercise: Map<string, LoggedSet[]>) {
  return days.find(d => !tagFortschritt(d.exercises, setsByExercise).fertig) ?? days[0] ?? null
}

export function trainingszeitDaten(sessions: TrainingSession[]) {
  const echte = sessions.filter(s => s.status === 'completed')
  const jetzt = Date.now()
  return {
    woche: echte.filter(s => jetzt - new Date(s.started_at).getTime() <= 7 * 864e5).reduce((a, s) => a + (s.minutes ?? 0), 0),
    gesamt: echte.reduce((a, s) => a + (s.minutes ?? 0), 0),
  }
}

export function dayTonnageFromSets(exerciseIds: string[], sets: LoggedSet[]) {
  return tonnageOf(sets.filter(s => exerciseIds.includes(s.exercise_id)))
}

export interface EinheitPunkt {
  sessionId: string
  datumLabel: string
  /** Startzeitpunkt in Millisekunden. Das Sternbild braucht den echten
      Abstand zwischen den Einheiten, nicht nur ihre Reihenfolge — sonst
      sähe eine Woche Pause aus wie ein Tag. */
  zeit: number
  wochenLabel: string
  tagName: string
  minuten: number
  tonnage: number
  erledigt: number
  geplant: number
  farbe: string
}

/** Die letzten `max` beendeten Einheiten mit Dauer und Tonnage — Grundlage
    für die Balkendiagramme "Trainingsdauer"/"Tonnage je Einheit". */
export function einheitenDaten(
  days: DayWithExercises[],
  sessions: TrainingSession[],
  alleSaetze: LoggedSet[],
  max = 14,
): EinheitPunkt[] {
  const abgeschlossen = sessions
    .filter(s => s.status === 'completed' && s.minutes != null)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .slice(-max)

  return abgeschlossen.map(s => {
    const tag = days.find(d => d.id === s.day_id)
    const saetzeDerWoche = tag ? alleSaetze.filter(x => x.week === s.week && tag.exercises.some(ex => ex.id === x.exercise_id)) : []
    const f = tag ? tagFortschritt(tag.exercises, gruppeSetsByExercise(saetzeDerWoche)) : { geplant: 0, erledigt: 0, tonnage: 0, anteil: 0, fertig: false }
    return {
      sessionId: s.id,
      datumLabel: new Date(s.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      zeit: new Date(s.started_at).getTime(),
      wochenLabel: `W${s.week}`,
      tagName: tag?.name ?? '—',
      minuten: s.minutes ?? 0,
      tonnage: f.tonnage,
      erledigt: f.erledigt,
      geplant: f.geplant,
      farbe: tagFarbe(days, s.day_id),
    }
  })
}

export type { TagFortschritt }
