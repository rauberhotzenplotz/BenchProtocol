import { useState } from 'react'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import {
  useCreateExercise,
  useDeleteExercise,
  useDeleteSet,
  useEndSession,
  useStartSession,
  useUpdateExercise,
  useUpsertSet,
} from './queries'
import { setsOf, tonnageOf, wochenLabel } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  session: TrainingSession | null | undefined
  onBack: () => void
}

export function SessionView({ plan, day, week, setsByExercise, session, onBack }: Props) {
  const startSession = useStartSession()
  const endSession = useEndSession()
  const createExercise = useCreateExercise(plan.id)

  const laeuft = !!session && !session.ended_at
  const [neueUebung, setNeueUebung] = useState(false)

  const gesamtTonnage = day.exercises.reduce((a, ex) => a + tonnageOf(setsByExercise.get(ex.id) ?? []), 0)
  const gesamtGeplant = day.exercises.reduce((a, ex) => a + setsOf(ex.scheme), 0)
  const gesamtErledigt = day.exercises.reduce((a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length, 0)

  return (
    <section className="view on frisch">
      <div className="ekopf" style={cssVars({ '--i': 0 })}>
        <button className="zurueck" onClick={onBack}>
          <svg viewBox="0 0 24 24">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Tage
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <span className="eyebrow" style={{ marginBottom: 3 }}>
            {wochenLabel(week, plan)}
            {plan.typ === 'bench' ? ` · Block ${plan.block ?? 1}` : ''}
          </span>
          <h2 style={{ margin: 0, fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            {day.name}
          </h2>
        </div>
      </div>

      <div className={'laufbar ' + (laeuft ? 'an' : 'aus')} style={cssVars({ '--i': 1 })}>
        <div>
          <div className="lab">{laeuft ? 'Läuft seit' : session?.minutes ? 'Gedauert' : 'Dauer'}</div>
          <div className="uhr">{session?.minutes ? `${session.minutes} min` : '—'}</div>
        </div>
        <div>
          <div className="lab">Sätze</div>
          <div className="uhr" style={{ fontSize: 20 }}>
            {gesamtErledigt}/{gesamtGeplant}
          </div>
        </div>
        <div>
          <div className="lab">Tonnage</div>
          <div className="uhr" style={{ fontSize: 20 }}>
            {Math.round(gesamtTonnage)}
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}> kg</span>
          </div>
        </div>
        <span className="spacer" />
        {laeuft ? (
          <button
            className="btn"
            onClick={() => session && void endSession.mutateAsync({ id: session.id, startedAt: session.started_at })}
          >
            Beenden
          </button>
        ) : (
          <button className="btn primary" onClick={() => void startSession.mutateAsync({ dayId: day.id, week })}>
            {session ? 'Erneut starten' : 'Training starten'}
          </button>
        )}
      </div>

      <div className="stack" style={{ ...cssVars({ '--i': 2 }), marginTop: 14, gap: 10 }}>
        {day.exercises.map(ex => (
          <ExerciseBlock
            key={ex.id}
            planId={plan.id}
            exercise={ex}
            sets={setsByExercise.get(ex.id) ?? []}
            week={week}
            laeuft={laeuft}
          />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {neueUebung ? (
          <NeueUebungForm
            onAbbrechen={() => setNeueUebung(false)}
            onAnlegen={async werte => {
              await createExercise.mutateAsync({
                day_id: day.id,
                sort_order: day.exercises.length,
                ...werte,
              })
              setNeueUebung(false)
            }}
          />
        ) : (
          <button className="btn sm ghost" onClick={() => setNeueUebung(true)}>
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Übung hinzufügen
          </button>
        )}
      </div>
    </section>
  )
}

function NeueUebungForm({
  onAnlegen,
  onAbbrechen,
}: {
  onAnlegen: (w: { name: string; scheme: string; rest: string; note: string }) => Promise<void>
  onAbbrechen: () => void
}) {
  const [name, setName] = useState('')
  const [scheme, setScheme] = useState('3 × 10')
  const [rest, setRest] = useState('2 min')

  return (
    <div className="card">
      <div className="stack">
        <div className="field">
          <label>Übungsname</label>
          <input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field">
            <label>Schema</label>
            <input className="inp mono" value={scheme} onChange={e => setScheme(e.target.value)} />
          </div>
          <div className="field">
            <label>Pause</label>
            <input className="inp mono" value={rest} onChange={e => setRest(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <button
            className="btn primary sm"
            disabled={!name.trim()}
            onClick={() => void onAnlegen({ name: name.trim(), scheme, rest, note: '' })}
          >
            Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}

function ExerciseBlock({
  planId,
  exercise,
  sets,
  week,
  laeuft,
}: {
  planId: string
  exercise: Exercise
  sets: LoggedSet[]
  week: number
  laeuft: boolean
}) {
  const [auf, setAuf] = useState(false)
  const updateExercise = useUpdateExercise(planId)
  const deleteExercise = useDeleteExercise(planId)
  const upsertSet = useUpsertSet()
  const deleteSetM = useDeleteSet()

  const soll = setsOf(exercise.scheme)
  const ok = sets.filter(s => s.done).length
  const fertig = sets.length > 0 && ok >= Math.min(soll, sets.length) && ok >= soll
  const naechstePosition = sets.length ? Math.max(...sets.map(s => s.position)) + 1 : 0

  return (
    <div className="card">
      <div className="row" style={{ cursor: 'pointer' }} onClick={() => setAuf(a => !a)}>
        <div style={{ flex: 1 }}>
          <b>{exercise.name}</b>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {exercise.scheme && <span className="chip mute">{exercise.scheme}</span>}
            {exercise.rest && <span className="chip mute">Pause {exercise.rest}</span>}
            {exercise.bench_slot && <span className="chip mute">Bank {exercise.bench_slot === 'd1' ? 'schwer' : 'Pause'}</span>}
          </div>
        </div>
        {fertig && <span className="chip ok">fertig</span>}
        <button
          className="rowbtn del"
          title="Übung löschen"
          onClick={e => {
            e.stopPropagation()
            if (confirm(`„${exercise.name}“ löschen?`)) deleteExercise.mutate(exercise.id)
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
          </svg>
        </button>
      </div>

      {auf && (
        <div className="ueb-koerper geoeffnet">
          <div className="setkopf">
            <span>#</span>
            <span>Gewicht</span>
            <span>Wdh.</span>
            <span>RPE</span>
            <span>OK</span>
            <span />
          </div>
          <div className="setgrid">
            {sets.length === 0 && <p className="muted tiny">Noch kein Satz — geplant sind {soll}.</p>}
            {sets.map(s => (
              <SetRow
                key={s.id}
                set={s}
                laeuft={laeuft}
                exerciseName={exercise.name}
                restSeconds={pauseSekunden(exercise.rest)}
                onChange={patch => upsertSet.mutate({ exercise_id: exercise.id, week, position: s.position, ...patch })}
                onDelete={() => deleteSetM.mutate(s.id)}
              />
            ))}
          </div>
          <div className="ueb-fuss">
            <button
              className="btn sm"
              onClick={() => upsertSet.mutate({ exercise_id: exercise.id, week, position: naechstePosition })}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Satz
            </button>
            {sets.length < soll && (
              <button
                className="btn sm ghost"
                onClick={() => {
                  const vorlage = sets[sets.length - 1]
                  for (let p = sets.length; p < soll; p++) {
                    upsertSet.mutate({
                      exercise_id: exercise.id,
                      week,
                      position: p,
                      kg: vorlage?.kg ?? null,
                      reps: vorlage?.reps ?? null,
                    })
                  }
                }}
              >
                Auf {soll} auffüllen
              </button>
            )}
            <span className="spacer" />
            <input
              className="inp voll dim"
              placeholder="Notiz"
              defaultValue={exercise.note ?? ''}
              onBlur={e => updateExercise.mutate({ id: exercise.id, patch: { note: e.target.value } })}
              style={{ maxWidth: 220 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SetRow({
  set,
  laeuft,
  exerciseName,
  restSeconds,
  onChange,
  onDelete,
}: {
  set: LoggedSet
  laeuft: boolean
  exerciseName: string
  restSeconds: number
  onChange: (patch: { kg?: number | null; reps?: number | null; rpe?: number | null; done?: boolean }) => void
  onDelete: () => void
}) {
  const [kg, setKg] = useState(set.kg?.toString() ?? '')
  const [reps, setReps] = useState(set.reps?.toString() ?? '')
  const [rpe, setRpe] = useState(set.rpe?.toString() ?? '')
  const restTimer = useRestTimer()

  const commit = () => {
    onChange({
      kg: kg.trim() ? parseFloat(kg.replace(',', '.')) : null,
      reps: reps.trim() ? parseInt(reps, 10) : null,
      rpe: rpe.trim() ? parseFloat(rpe.replace(',', '.')) : null,
    })
  }

  const haken = () => {
    const wirdErledigt = !set.done
    onChange({ done: wirdErledigt })
    if (wirdErledigt && autoPauseAn() && restSeconds > 0) restTimer.start(restSeconds, exerciseName)
  }

  return (
    <div className={'setline' + (set.done ? ' ok' : '')}>
      <span className="nr">{set.position + 1}</span>
      <input className="inp mono" value={kg} placeholder="kg" inputMode="decimal" onChange={e => setKg(e.target.value)} onBlur={commit} />
      <input
        className="inp mono"
        value={reps}
        placeholder="Wdh"
        inputMode="numeric"
        onChange={e => setReps(e.target.value)}
        onBlur={commit}
      />
      <input
        className="inp mono"
        value={rpe}
        placeholder="RPE"
        inputMode="decimal"
        onChange={e => setRpe(e.target.value)}
        onBlur={commit}
      />
      <button
        className="sethaken"
        aria-pressed={set.done}
        disabled={!laeuft}
        title={laeuft ? 'Satz erledigt' : 'Erst das Training starten'}
        onClick={haken}
      >
        ✓
      </button>
      <button className="rowbtn del" title="Satz löschen" onClick={onDelete}>
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
        </svg>
      </button>
    </div>
  )
}
