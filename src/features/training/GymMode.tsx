import { useEffect, useState } from 'react'
import type { LoggedSet, Plan } from '../../types/db'
import type { DayWithExercises } from './queries'
import { setsOf, letzterSatz } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { useUpsertSet } from './queries'
import { baseE1RM, mround } from '../bench/calc'
import { GymRing } from '../../components/GymRing'

function zielWdh(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)/i)
  return m ? +m[1] : 8
}

const AUFWAERM_STUFEN = [
  { label: 'Leere Stange', anteil: 0, reps: 10 },
  { label: '50 %', anteil: 0.5, reps: 5 },
  { label: '65 %', anteil: 0.65, reps: 3 },
  { label: '75 %', anteil: 0.75, reps: 1 },
]

interface Props {
  plan: Plan
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  alleSaetzeJemals: LoggedSet[]
  onClose: () => void
}

export function GymMode({ plan, day, week, setsByExercise, alleSaetzeJemals, onClose }: Props) {
  const upsertSet = useUpsertSet()
  const restTimer = useRestTimer()
  const [uebIdx, setUebIdx] = useState(0)
  const [satzIdx, setSatzIdx] = useState(0)
  const [aufgewaermt, setAufgewaermt] = useState<Set<string>>(new Set())

  // Solange der Gym-Modus offen ist, übernimmt er selbst die große
  // Pausenanzeige — die kleine schwebende Leiste bleibt aus.
  useEffect(() => {
    restTimer.setGymActive(true)
    return () => restTimer.setGymActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mounten/Unmounten schalten, nicht bei jeder Timer-Änderung
  }, [])

  const uebungen = day.exercises
  const exercise = uebungen[Math.min(uebIdx, uebungen.length - 1)]
  const sets = setsByExercise.get(exercise.id) ?? []
  const soll = setsOf(exercise.scheme)
  const aktuellerSatz = sets.find(s => s.position === satzIdx)
  const vorschlag = letzterSatz(exercise.id, alleSaetzeJemals)

  const [kg, setKg] = useState(() => aktuellerSatz?.kg ?? vorschlag?.kg ?? 0)
  const [reps, setReps] = useState(() => aktuellerSatz?.reps ?? vorschlag?.reps ?? zielWdh(exercise.scheme))
  const [rpe, setRpe] = useState(() => aktuellerSatz?.rpe ?? vorschlag?.rpe ?? 0)

  // Beim Wechsel auf einen anderen Satz/Übung die Eingabefelder neu vorbelegen.
  const schluessel = `${exercise.id}|${satzIdx}`
  const [letzterSchluessel, setLetzterSchluessel] = useState(schluessel)
  if (schluessel !== letzterSchluessel) {
    setLetzterSchluessel(schluessel)
    setKg(aktuellerSatz?.kg ?? vorschlag?.kg ?? 0)
    setReps(aktuellerSatz?.reps ?? vorschlag?.reps ?? zielWdh(exercise.scheme))
    setRpe(aktuellerSatz?.rpe ?? vorschlag?.rpe ?? 0)
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
    upsertSet.mutate({ exercise_id: exercise.id, week, position: satzIdx, kg, reps, rpe: rpe || null, done: true })
    const sek = pauseSekunden(exercise.rest)
    if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    naechster()
  }

  const plate = plan.plate ?? 2.5

  // Pause: solange ein Timer läuft (oder gerade fertig ist und noch
  // ausgeblendet wird), zeigt der Gym-Modus großflächig denselben Ring wie
  // die kleine Leiste sonst — "derselbe Timer, nur im Vollbild".
  if (restTimer.label != null) {
    return (
      <div className="gym">
        <button className="gym-zu" onClick={onClose} aria-label="Gym-Modus verlassen">
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="gym-inhalt">
          <div className="gym-pause">
            <GymRing secondsLeft={restTimer.secondsLeft} totalSeconds={restTimer.totalSeconds} />
            <div className="gym-naechst">Als Nächstes: {exercise.name}</div>
          </div>
          <div className="gym-tasten zwei">
            <button className="gym-taste grau" onClick={() => restTimer.addSeconds(15)}>
              +15s
            </button>
            <button className="gym-taste ok" onClick={restTimer.stop}>
              Weiter
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Aufwärmen: nur beim ersten Satz einer an die Bank-Progression
  // gekoppelten Übung, einmal je Übung.
  if (exercise.bench_slot && satzIdx === 0 && !aufgewaermt.has(exercise.id)) {
    const e1 = baseE1RM(plan)
    return (
      <div className="gym">
        <button className="gym-zu" onClick={onClose} aria-label="Gym-Modus verlassen">
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="gym-inhalt">
          <div className="gym-kopf">
            <div className="gym-fort">Vor den Arbeitssätzen</div>
            <div className="gym-ueb">{exercise.name}</div>
          </div>
          <div className="gym-warm">
            <div className="gym-wtitel">Aufwärmen</div>
            <div className="gym-wliste">
              {AUFWAERM_STUFEN.map(s => (
                <div key={s.label} className="gym-wzeile">
                  <span className="nr">{s.anteil === 0 ? '—' : `${Math.round(s.anteil * 100)}%`}</span>
                  <span className="pct">{s.label}</span>
                  <span className="kg">
                    {s.anteil === 0 ? '—' : mround(e1 * s.anteil, plate)}
                    {s.anteil > 0 && <em>kg</em>}
                  </span>
                  <span className="wdh">× {s.reps}</span>
                </div>
              ))}
              <div className="gym-wzeile arbeit">
                <span className="nr">→</span>
                <span className="pct">Arbeitssatz</span>
                <span className="kg">
                  {kg}
                  <em>kg</em>
                </span>
                <span className="wdh">× {reps}</span>
              </div>
            </div>
          </div>
          <div className="gym-tasten">
            <button className="gym-taste neon" onClick={() => setAufgewaermt(prev => new Set(prev).add(exercise.id))}>
              Aufgewärmt — weiter zu den Arbeitssätzen
            </button>
          </div>
        </div>
      </div>
    )
  }

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
            <div className="gym-kg" style={{ minWidth: '5.5ch', textAlign: 'center' }}>
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
            <div className="gym-wdh" style={{ minWidth: '2.5ch', textAlign: 'center' }}>
              {reps}
              <span>Wdh.</span>
            </div>
            <button className="gym-kgtaste" onClick={() => setReps(r => r + 1)} aria-label="Wiederholungen erhöhen">
              +
            </button>
          </div>
          <div className="gym-kzeile" style={{ marginTop: 14, width: '100%', maxWidth: 380 }}>
            <span className="lab">RPE</span>
            <button className="gym-pm" onClick={() => setRpe(r => Math.max(0, Math.round((r - 0.5) * 2) / 2))} aria-label="RPE verringern">
              −
            </button>
            <span className={'wert' + (rpe ? '' : ' leer')}>{rpe || '—'}</span>
            <button className="gym-pm" onClick={() => setRpe(r => Math.round((r + 0.5) * 2) / 2)} aria-label="RPE erhöhen">
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
