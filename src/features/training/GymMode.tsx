import { useState } from 'react'
import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from './queries'
import { setsOf } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { useUpsertSet } from './queries'

function zielWdh(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)/i)
  return m ? +m[1] : 8
}

interface Props {
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  onClose: () => void
}

export function GymMode({ day, week, setsByExercise, onClose }: Props) {
  const upsertSet = useUpsertSet()
  const restTimer = useRestTimer()
  const [uebIdx, setUebIdx] = useState(0)
  const [satzIdx, setSatzIdx] = useState(0)

  const uebungen = day.exercises
  const exercise = uebungen[Math.min(uebIdx, uebungen.length - 1)]
  const sets = setsByExercise.get(exercise.id) ?? []
  const soll = setsOf(exercise.scheme)
  const aktuellerSatz = sets.find(s => s.position === satzIdx)
  const letzterErledigter = [...sets].reverse().find(s => s.done && s.kg != null)

  const [kg, setKg] = useState(() => aktuellerSatz?.kg ?? letzterErledigter?.kg ?? 0)
  const [reps, setReps] = useState(() => aktuellerSatz?.reps ?? zielWdh(exercise.scheme))

  // Beim Wechsel auf einen anderen Satz/Übung die Eingabefelder neu vorbelegen.
  const schluessel = `${exercise.id}|${satzIdx}`
  const [letzterSchluessel, setLetzterSchluessel] = useState(schluessel)
  if (schluessel !== letzterSchluessel) {
    setLetzterSchluessel(schluessel)
    setKg(aktuellerSatz?.kg ?? letzterErledigter?.kg ?? 0)
    setReps(aktuellerSatz?.reps ?? zielWdh(exercise.scheme))
  }

  const gesamtGeplant = uebungen.reduce((a, ex) => a + setsOf(ex.scheme), 0)
  const bisHierGeplant = uebungen.slice(0, uebIdx).reduce((a, ex) => a + setsOf(ex.scheme), 0) + satzIdx
  const anteil = gesamtGeplant ? Math.min(1, bisHierGeplant / gesamtGeplant) : 0

  const naechster = () => {
    if (satzIdx + 1 < soll) {
      setSatzIdx(satzIdx + 1)
    } else if (uebIdx + 1 < uebungen.length) {
      setUebIdx(uebIdx + 1)
      setSatzIdx(0)
    } else {
      onClose()
    }
  }

  const erledigt = () => {
    upsertSet.mutate({ exercise_id: exercise.id, week, position: satzIdx, kg, reps, done: true })
    const sek = pauseSekunden(exercise.rest)
    if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    naechster()
  }

  const plate = 2.5

  return (
    <div className="gym">
      <button className="gym-zu" onClick={onClose} aria-label="Gym-Modus verlassen">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="gym-inhalt">
        <div className="gym-kopf">
          <div className="gym-fort">
            Übung {uebIdx + 1} von {uebungen.length} · Satz {satzIdx + 1} von {soll}
          </div>
          <div className="gym-ueb">{exercise.name}</div>
          <div className="gym-balken">
            <i style={{ width: `${(anteil * 100).toFixed(0)}%` }} />
          </div>
        </div>

        <div className="gym-mitte">
          <div className="gym-kgzeile">
            <button className="gym-kgtaste" onClick={() => setKg(k => Math.max(0, k - plate))} aria-label="Gewicht verringern">
              −
            </button>
            <div className="gym-kg">
              {kg}
              <em>kg</em>
            </div>
            <button className="gym-kgtaste" onClick={() => setKg(k => k + plate)} aria-label="Gewicht erhöhen">
              +
            </button>
          </div>
          <div className="gym-kgzeile" style={{ marginTop: 10 }}>
            <button className="gym-kgtaste" onClick={() => setReps(r => Math.max(0, r - 1))} aria-label="Wiederholungen verringern">
              −
            </button>
            <div className="gym-wdh">
              {reps}
              <span>Wdh.</span>
            </div>
            <button className="gym-kgtaste" onClick={() => setReps(r => r + 1)} aria-label="Wiederholungen erhöhen">
              +
            </button>
          </div>
          {exercise.rest && <div className="gym-hinweis">Pause {exercise.rest}</div>}
        </div>

        <div className="gym-tasten zwei">
          <button className="gym-taste grau" onClick={naechster}>
            Überspringen
          </button>
          <button className="gym-taste ok" onClick={erledigt}>
            <svg viewBox="0 0 24 24">
              <path d="M4 12.5 9.5 18 20 6.5" />
            </svg>
            Erledigt
          </button>
        </div>
      </div>
    </div>
  )
}
