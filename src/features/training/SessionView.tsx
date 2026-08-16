import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BenchSlot, Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import {
  useCreateExercise,
  useDeleteExercise,
  useDeleteSet,
  useEndSession,
  useStartSession,
  useUpdateDay,
  useUpdateExercise,
  useUpsertSet,
} from './queries'
import { setsOf, tonnageOf, wochenLabel, istBankdruecken } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { GymMode } from './GymMode'
import { Warp } from './Warp'
import { DeloadBanner } from './DeloadBanner'
import { useAutoAdvanceBlock } from '../bench/queries'
import { useVolumeRows } from '../volume/queries'
import { cssVars } from '../../lib/style'
import { ZahlEingabe } from '../../components/ZahlRad'
import { zahlenBereich } from '../../lib/zahlen'

const REP_WERTE = zahlenBereich(1, 30, 1)
const RPE_WERTE = zahlenBereich(5, 10, 0.5)
const PAUSE_MINUTEN = zahlenBereich(0.5, 6, 0.5)

function formatPause(min: number): string {
  return (Number.isInteger(min) ? String(min) : min.toFixed(1).replace('.', ',')) + ' min'
}

interface Props {
  plan: Plan
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  alleSaetzeJemals: LoggedSet[]
  alleSaetzeJemalsBereit: boolean
  session: TrainingSession | null | undefined
  onBack: () => void
}

export function SessionView({ plan, day, week, setsByExercise, alleSaetzeJemals, alleSaetzeJemalsBereit, session, onBack }: Props) {
  const startSession = useStartSession()
  const endSession = useEndSession()
  const autoAdvanceBlock = useAutoAdvanceBlock()
  const createExercise = useCreateExercise(plan.id)
  const updateDay = useUpdateDay(plan.id)
  const { data: volumeRows } = useVolumeRows(plan.id)
  const muskelgruppen = (volumeRows ?? []).map(r => r.muscle_group)

  const [nameBearbeiten, setNameBearbeiten] = useState(false)
  const [neuerName, setNeuerName] = useState(day.name)
  const nameSpeichern = () => {
    setNameBearbeiten(false)
    const trimmed = neuerName.trim()
    if (trimmed && trimmed !== day.name) updateDay.mutate({ id: day.id, patch: { name: trimmed } })
    else setNeuerName(day.name)
  }

  const beenden = async () => {
    if (!session) return
    await endSession.mutateAsync({ id: session.id, startedAt: session.started_at })
    if (plan.typ === 'bench') autoAdvanceBlock.mutate(plan.id)
  }

  const laeuft = !!session && !session.ended_at
  const [neueUebung, setNeueUebung] = useState(false)
  const [gymOffen, setGymOffen] = useState(false)
  const [warpLaeuft, setWarpLaeuft] = useState(false)

  // Der Sprung läuft vor dem Gym-Modus, nicht darüber: er deckt die
  // Einheit ab und gibt am Ende die fertige Trainingskonsole frei.
  const gymStarten = () => {
    // Steht der Bewegungsschalter auf aus, entsteht der Sprung gar nicht
    // erst — sonst bliebe eine knappe Sekunde schwarzer Bildschirm ohne
    // erkennbaren Grund, weil die globale Regel nur die Dauer staucht.
    if (document.documentElement.dataset.motion === 'off') setGymOffen(true)
    else setWarpLaeuft(true)
  }

  // Beide Zustände im selben Handler: React fasst sie zu einem Commit
  // zusammen, der Sprung verschwindet also in genau dem Bild, in dem der
  // Gym-Modus erscheint. Nacheinander gäbe es ein Bild dazwischen, in dem
  // die Einheit wieder durchblitzt.
  const warpFertig = useCallback(() => {
    setWarpLaeuft(false)
    setGymOffen(true)
  }, [])
  // Kommt man aus dem Gym-Modus zum Prüfen zurück, sollen die Sätze nicht
  // erst einzeln aufgeklappt werden müssen.
  const [saetzeOffen, setSaetzeOffen] = useState(false)

  const gesamtTonnage = day.exercises.reduce((a, ex) => a + tonnageOf(setsByExercise.get(ex.id) ?? []), 0)
  const gesamtGeplant = day.exercises.reduce((a, ex) => a + setsOf(ex.scheme), 0)
  const gesamtErledigt = day.exercises.reduce((a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length, 0)

  return (
    <section className="view on frisch">
      {!laeuft && <DeloadBanner plan={plan} />}

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
          {nameBearbeiten ? (
            <input
              className="inp"
              autoFocus
              value={neuerName}
              onChange={e => setNeuerName(e.target.value)}
              onBlur={nameSpeichern}
              onKeyDown={e => {
                if (e.key === 'Enter') nameSpeichern()
                if (e.key === 'Escape') {
                  setNeuerName(day.name)
                  setNameBearbeiten(false)
                }
              }}
              style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', maxWidth: 320 }}
            />
          ) : (
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1 }}>
                {day.name}
              </h2>
              <button
                className="rowbtn"
                title="Tag umbenennen"
                aria-label={`${day.name} umbenennen`}
                onClick={() => {
                  setNeuerName(day.name)
                  setNameBearbeiten(true)
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
          )}
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
          <>
            {day.exercises.length > 0 && (
              <button className="btn" onClick={gymStarten}>
                <svg viewBox="0 0 24 24">
                  <path d="M5 8v8M19 8v8M2 10v4M22 10v4M5 12h14" />
                </svg>
                Gym
              </button>
            )}
            <button className="btn" onClick={() => void beenden()}>
              Beenden
            </button>
          </>
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
            planTyp={plan.typ}
            exercise={ex}
            sets={setsByExercise.get(ex.id) ?? []}
            week={week}
            laeuft={laeuft}
            aufklappen={saetzeOffen}
            muskelgruppen={muskelgruppen}
            plate={plan.plate ?? 2.5}
          />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {neueUebung ? (
          <NeueUebungForm
            planTyp={plan.typ}
            muskelgruppen={muskelgruppen}
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

      {warpLaeuft && <Warp onEnde={warpFertig} />}

      {gymOffen &&
        day.exercises.length > 0 &&
        createPortal(
          // Portal statt normalem Kind-Render: der Gym-Modus ist ein
          // position:fixed-Vollbild, aber die umgebende <section> hier trägt
          // die "frisch"-Eintrittsanimation (transform-Keyframes). Ein
          // animiertes Elternelement wird für fixed-Nachfahren zum
          // Containing Block — ohne Portal würde der Gym-Modus dadurch auf
          // die Größe der Section zusammengequetscht statt den Bildschirm
          // zu füllen (Aufwärmen/Sätze wirken dann verschoben/überlappend).
          <GymMode
            plan={plan}
            day={day}
            week={week}
            setsByExercise={setsByExercise}
            alleSaetzeJemals={alleSaetzeJemals}
            alleSaetzeJemalsBereit={alleSaetzeJemalsBereit}
            session={session}
            onClose={() => setGymOffen(false)}
            onPruefen={() => {
              setGymOffen(false)
              setSaetzeOffen(true)
            }}
          />,
          document.body,
        )}
    </section>
  )
}

function NeueUebungForm({
  planTyp,
  muskelgruppen,
  onAnlegen,
  onAbbrechen,
}: {
  planTyp: Plan['typ']
  muskelgruppen: string[]
  onAnlegen: (w: { name: string; scheme: string; rest: string; note: string; bench_slot: BenchSlot | null; muscle_group: string | null }) => Promise<void>
  onAbbrechen: () => void
}) {
  const [name, setName] = useState('')
  const [scheme, setScheme] = useState('3 × 10')
  const [restMin, setRestMin] = useState(2)
  const [benchSlot, setBenchSlot] = useState<BenchSlot | null>(null)
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null)

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
            <ZahlEingabe
              wert={restMin}
              werte={PAUSE_MINUTEN}
              format={formatPause}
              titel="Pause"
              einheit="min"
              className="mono"
              onWahl={n => setRestMin(n ?? 2)}
            />
          </div>
        </div>
        {planTyp === 'bench' && (
          <div className="field">
            <label>Bank-Zuordnung</label>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className={'chip' + (benchSlot === null ? ' neon' : ' mute')}
                onClick={() => setBenchSlot(null)}
              >
                Keine
              </button>
              <button
                type="button"
                className={'chip' + (benchSlot === 'd1' ? ' neon' : ' mute')}
                onClick={() => setBenchSlot('d1')}
              >
                Bankdrücken schwer
              </button>
              <button
                type="button"
                className={'chip' + (benchSlot === 'd3' ? ' neon' : ' mute')}
                onClick={() => setBenchSlot('d3')}
              >
                Bankdrücken leicht
              </button>
            </div>
          </div>
        )}
        {muskelgruppen.length > 0 && (
          <div className="field">
            <label>Muskelgruppe</label>
            <select className="inp" value={muscleGroup ?? ''} onChange={e => setMuscleGroup(e.target.value || null)}>
              <option value="">Keine</option>
              {muskelgruppen.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <button
            className="btn primary sm"
            disabled={!name.trim()}
            onClick={() => void onAnlegen({ name: name.trim(), scheme, rest: formatPause(restMin), note: '', bench_slot: benchSlot, muscle_group: muscleGroup })}
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
  planTyp,
  exercise,
  sets,
  week,
  laeuft,
  aufklappen,
  muskelgruppen,
  plate,
}: {
  planId: string
  planTyp: Plan['typ']
  exercise: Exercise
  sets: LoggedSet[]
  week: number
  muskelgruppen: string[]
  laeuft: boolean
  /** Von außen angestoßenes Aufklappen (Rückkehr aus dem Gym-Modus). Danach
      bleibt das Auf- und Zuklappen wieder ganz beim Nutzer. */
  aufklappen: boolean
  plate: number
}) {
  const [auf, setAuf] = useState(aufklappen)
  // Abgeleiteter Zustand beim Rendern nachgezogen — dasselbe Muster wie
  // sonst in dieser Datei, statt eines Effekts mit zusätzlichem Durchlauf.
  const [letzteVorgabe, setLetzteVorgabe] = useState(aufklappen)
  if (aufklappen !== letzteVorgabe) {
    setLetzteVorgabe(aufklappen)
    if (aufklappen) setAuf(true)
  }
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false)
  const updateExercise = useUpdateExercise(planId)
  const deleteExercise = useDeleteExercise(planId)
  const upsertSet = useUpsertSet()
  const deleteSetM = useDeleteSet()

  const soll = setsOf(exercise.scheme)
  const ok = sets.filter(s => s.done).length
  const fertig = sets.length > 0 && ok >= Math.min(soll, sets.length) && ok >= soll
  const naechstePosition = sets.length ? Math.max(...sets.map(s => s.position)) + 1 : 0
  const bankdruecken = istBankdruecken(exercise)

  return (
    <div className="card">
      <div className="row" style={{ cursor: 'pointer' }} onClick={() => setAuf(a => !a)}>
        <div style={{ flex: 1 }}>
          <b>{exercise.name}</b>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {exercise.scheme && <span className="chip mute">{exercise.scheme}</span>}
            {exercise.rest && <span className="chip mute">Pause {exercise.rest}</span>}
            {exercise.bench_slot && <span className="chip mute">Bank {exercise.bench_slot === 'd1' ? 'schwer' : 'leicht'}</span>}
            {exercise.muscle_group && <span className="chip mute">{exercise.muscle_group}</span>}
          </div>
        </div>
        {fertig && <span className="chip ok">fertig</span>}
        {loeschenBestaetigen ? (
          <div className="row" style={{ gap: 6 }} onClick={e => e.stopPropagation()}>
            <button className="btn ghost sm" onClick={() => setLoeschenBestaetigen(false)}>
              Abbrechen
            </button>
            <button className="btn sm danger" onClick={() => deleteExercise.mutate(exercise.id)}>
              Löschen
            </button>
          </div>
        ) : (
          <button
            className="rowbtn del"
            title="Übung löschen"
            onClick={e => {
              e.stopPropagation()
              setLoeschenBestaetigen(true)
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
            </svg>
          </button>
        )}
      </div>

      {auf && (
        <div className="ueb-koerper geoeffnet">
          <div className={'setkopf' + (bankdruecken ? '' : ' ohne-rpe')}>
            <span>#</span>
            <span>Gewicht</span>
            <span>Wdh.</span>
            {bankdruecken && <span>RPE</span>}
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
                plate={plate}
                zeigtRpe={bankdruecken}
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
          {planTyp === 'bench' && (
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="muted tiny">Bank-Zuordnung (Aufwärmsätze im Gym-Modus):</span>
              <button
                type="button"
                className={'chip' + (exercise.bench_slot === null ? ' neon' : ' mute')}
                onClick={() => updateExercise.mutate({ id: exercise.id, patch: { bench_slot: null } })}
              >
                Keine
              </button>
              <button
                type="button"
                className={'chip' + (exercise.bench_slot === 'd1' ? ' neon' : ' mute')}
                onClick={() => updateExercise.mutate({ id: exercise.id, patch: { bench_slot: 'd1' } })}
              >
                Schwer
              </button>
              <button
                type="button"
                className={'chip' + (exercise.bench_slot === 'd3' ? ' neon' : ' mute')}
                onClick={() => updateExercise.mutate({ id: exercise.id, patch: { bench_slot: 'd3' } })}
              >
                Leicht
              </button>
            </div>
          )}
          {muskelgruppen.length > 0 && (
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="muted tiny">Muskelgruppe (fürs Wochenvolumen):</span>
              <select
                className="inp mono"
                style={{ width: 'auto' }}
                value={exercise.muscle_group ?? ''}
                onChange={e => updateExercise.mutate({ id: exercise.id, patch: { muscle_group: e.target.value || null } })}
              >
                <option value="">Keine</option>
                {muskelgruppen.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
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
  plate,
  zeigtRpe,
  onChange,
  onDelete,
}: {
  set: LoggedSet
  laeuft: boolean
  exerciseName: string
  restSeconds: number
  plate: number
  zeigtRpe: boolean
  onChange: (patch: { kg?: number | null; reps?: number | null; rpe?: number | null; done?: boolean; done_at?: string | null }) => void
  onDelete: () => void
}) {
  const restTimer = useRestTimer()
  const kgWerte = zahlenBereich(plate, 300, plate)

  const haken = () => {
    const wirdErledigt = !set.done
    onChange({ done: wirdErledigt, done_at: wirdErledigt ? new Date().toISOString() : null })
    if (wirdErledigt && autoPauseAn() && restSeconds > 0) restTimer.start(restSeconds, exerciseName)
  }

  return (
    <div className={'setline' + (set.done ? ' ok' : '') + (zeigtRpe ? '' : ' ohne-rpe')}>
      <span className="nr">{set.position + 1}</span>
      <ZahlEingabe wert={set.kg} werte={kgWerte} titel="Gewicht" einheit="kg" className="mono kgw" leerOption onWahl={kg => onChange({ kg })} />
      <ZahlEingabe wert={set.reps} werte={REP_WERTE} titel="Wiederholungen" className="mono repw" leerOption onWahl={reps => onChange({ reps })} />
      {zeigtRpe && <ZahlEingabe wert={set.rpe} werte={RPE_WERTE} titel="RPE" className="mono rpew" leerOption onWahl={rpe => onChange({ rpe })} />}
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
