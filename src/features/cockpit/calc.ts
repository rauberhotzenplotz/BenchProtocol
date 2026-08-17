import type { DayWithExercises } from '../training/queries'
import { tagFortschritt, tonnageOf, gruppeSetsByExercise, setsOf, type TagFortschritt } from '../training/calc'
import { tagFarbe } from '../training/dayColor'
import type { LoggedSet, TrainingSession } from '../../types/db'

export function naechsterTag(days: DayWithExercises[], setsByExercise: Map<string, LoggedSet[]>) {
  return days.find(d => !tagFortschritt(d.exercises, setsByExercise).fertig) ?? days[0] ?? null
}

export interface StartInfo {
  uebungen: string[]
  saetze: number
  /** Erfahrungswert aus beendeten Einheiten genau dieses Tages. Ohne eine
      einzige beendete Einheit bleibt er null — dann steht in der Startkarte
      keine Dauer statt einer erfundenen Schätzung. */
  minuten: number | null
}

/** Was in der nächsten Einheit ansteht: Übungsnamen, geplante Sätze und die
    übliche Dauer. Grundlage der Startkarte im Cockpit. */
export function startInfo(tag: DayWithExercises | null, sessions: TrainingSession[]): StartInfo | null {
  if (!tag) return null
  const beendet = sessions.filter(s => s.day_id === tag.id && s.status === 'completed' && s.minutes != null)
  return {
    uebungen: tag.exercises.map(ex => ex.name),
    saetze: tag.exercises.reduce((a, ex) => a + setsOf(ex.scheme), 0),
    minuten: beendet.length ? Math.round(beendet.reduce((a, s) => a + (s.minutes ?? 0), 0) / beendet.length) : null,
  }
}

/** Beendete Einheiten dieser Woche gegen die Zahl der Trainingstage des
    Plans — das Soll/Ist der laufenden Woche für den Fortschrittsmesser. */
export function wochenPensum(days: DayWithExercises[], sessions: TrainingSession[], week: number) {
  const erledigt = sessions.filter(s => s.week === week && s.status === 'completed' && s.ended_at).length
  return { erledigt: Math.min(erledigt, days.length), geplant: days.length }
}

export function trainingszeitDaten(sessions: TrainingSession[]) {
  const echte = sessions.filter(s => s.status === 'completed')
  const jetzt = Date.now()
  const minutenZwischen = (abTagen: number, bisTagen: number) =>
    echte
      .filter(s => {
        const alterTage = (jetzt - new Date(s.started_at).getTime()) / 864e5
        return alterTage >= abTagen && alterTage < bisTagen
      })
      .reduce((a, s) => a + (s.minutes ?? 0), 0)
  return {
    woche: minutenZwischen(0, 7),
    vorwoche: minutenZwischen(7, 14),
    gesamt: echte.reduce((a, s) => a + (s.minutes ?? 0), 0),
  }
}

/** Veränderung in Prozent ggü. einem Vorwert — ohne Vorwert (0 oder nichts
    geloggt) gibt es keine sinnvolle Prozentzahl, dann lieber nichts zeigen
    als eine unendliche/verzerrte Angabe. */
export function prozentAenderung(aktuell: number, vorher: number): number | null {
  if (!vorher) return null
  return Math.round(((aktuell - vorher) / vorher) * 100)
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
