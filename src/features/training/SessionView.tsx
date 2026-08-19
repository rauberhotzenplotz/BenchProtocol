import { useCallback, useEffect, useRef, useState } from 'react'
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
import { setsOf, tonnageOf, wochenLabel, istBankdruecken, satzE1rm, letzteEinheitFuerUebung, muskelgruppenDesTags } from './calc'
import { LetzteEinheitPanel } from './LetzteEinheitPanel'
import { MuskelChips } from '../../components/MuskelChips'
import { SessionMenu } from './SessionMenu'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { GymModeAP } from './GymModeAP'
import { Warp } from './Warp'
import { DeloadBanner } from './DeloadBanner'
import { useVolumeRows } from '../volume/queries'
import { neueId } from '../../lib/offline/keys'
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
  /** Ob die Historie fertig geladen ist. Wird seit der Umstellung auf
      GymModeAP hier nicht mehr ausgewertet (der neue Gym-Modus belegt
      keine Eingabefelder mehr vorab vor), bleibt aber Teil der
      Schnittstelle, solange TrainingPage sie liefert. */
  alleSaetzeJemalsBereit?: boolean
  session: TrainingSession | null | undefined
  onBack: () => void
  /** Kommt man aus dem Cockpit über "Als Nächstes": Session sofort starten
   *  und direkt in den Gym-Modus springen, ohne Zwischenklick. */
  autoStartGym?: boolean
  onAutoStartConsumed?: () => void
}

export function SessionView({
  plan,
  day,
  week,
  setsByExercise,
  alleSaetzeJemals,
  session,
  onBack,
  autoStartGym,
  onAutoStartConsumed,
}: Props) {
  const startSession = useStartSession()
  const endSession = useEndSession()
  const createExercise = useCreateExercise()
  const updateDay = useUpdateDay()
  const { data: volumeRows } = useVolumeRows(plan.id)
  const muskelgruppen = (volumeRows ?? []).map(r => r.muscle_group)
  const restTimer = useRestTimer()

  const [nameBearbeiten, setNameBearbeiten] = useState(false)
  const [neuerName, setNeuerName] = useState(day.name)
  const nameSpeichern = () => {
    setNameBearbeiten(false)
    const trimmed = neuerName.trim()
    if (trimmed && trimmed !== day.name) updateDay.mutate({ id: day.id, patch: { name: trimmed } })
    else setNeuerName(day.name)
  }

  const beenden = () => {
    if (!session) return
    // Kein await: offline pausiert die Mutation, der Knopf bliebe sonst
    // hängen. Der automatische Block-Check läuft ohnehin nicht hier,
    // sondern im registrierten onSuccess von endSession
    // (src/lib/offline/training.ts) — also erst nach bestätigtem Sync.
    endSession.mutate({ id: session.id, startedAt: session.started_at, dayId: day.id, week, planId: plan.id, planTyp: plan.typ })
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
  // Auto-Start aus dem Cockpit: erst die Session anstoßen (falls sie noch
  // nicht läuft), dann — sobald sie da ist — den Warp-Sprung in den
  // Gym-Modus auslösen. Zwei Ref-Wächter statt Zustand, damit jeder
  // Schritt trotz mehrfacher Renders während der Mutation nur einmal
  // ausgelöst wird.
  const autoSessionAngestossen = useRef(false)
  const autoGymAusgeloest = useRef(false)
  useEffect(() => {
    if (!autoStartGym || day.exercises.length === 0) return
    if (!laeuft) {
      if (!autoSessionAngestossen.current) {
        autoSessionAngestossen.current = true
        startSession.mutate({ dayId: day.id, week })
      }
      return
    }
    if (!autoGymAusgeloest.current) {
      autoGymAusgeloest.current = true
      gymStarten()
      onAutoStartConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gymStarten/startSession sind pro Render neue Referenzen, sollen die Wächter-Logik hier aber nicht erneut auslösen
  }, [autoStartGym, laeuft, day.id, day.exercises.length, week])

  // Der Gym-Modus (GymModeAP) zeigt die ganze Übung als Tabelle statt einen
  // Satz pro Bildschirm und merkt sich seine Position selbst — die früher
  // hier gehaltene Positionsverfolgung entfällt dadurch. Aufgeklappt wird
  // die Satzliste nur noch vom Nutzer selbst.
  const saetzeOffen = false

  // Solange diese Einheit offen ist, kann die schwebende Pausenleiste
  // (außerhalb des Gym-Modus) über einen Tap direkt wieder in den
  // Gym-Modus springen — auch wenn man gerade nur die Sätze ohne
  // Gym-Modus prüft. Ein Effekt ist hier richtig: es wird kein eigener
  // State gesetzt, nur der (externe) RestTimer-Context benachrichtigt.
  useEffect(() => {
    restTimer.setReopenGym(() => setGymOffen(true))
    return () => restTimer.setReopenGym(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restTimer.setReopenGym ist über den Context stabil, nur beim Mounten/Unmounten registrieren
  }, [])

  const gesamtTonnage = day.exercises.reduce((a, ex) => a + tonnageOf(setsByExercise.get(ex.id) ?? []), 0)
  const gesamtGeplant = day.exercises.reduce((a, ex) => a + setsOf(ex.scheme), 0)
  const gesamtErledigt = day.exercises.reduce((a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length, 0)
  const muskelgruppenDesTagsListe = muskelgruppenDesTags(day.exercises)

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

      {muskelgruppenDesTagsListe.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <MuskelChips gruppen={muskelgruppenDesTagsListe} />
        </div>
      )}

      <div className={'laufbar ' + (laeuft ? 'an' : 'aus')} style={cssVars({ '--i': 1 })}>
        <div>
          <div className="lab">{session?.paused_at ? 'Pausiert' : laeuft ? 'Läuft seit' : session?.minutes ? 'Gedauert' : 'Dauer'}</div>
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
              <button className="btn primary" onClick={gymStarten}>
                <svg viewBox="0 0 24 24">
                  <path d="M5 8v8M19 8v8M2 10v4M22 10v4M5 12h14" />
                </svg>
                Gym
              </button>
            )}
            {session && (
              <SessionMenu
                session={session}
                dayId={day.id}
                week={week}
                exerciseIds={day.exercises.map(ex => ex.id)}
                onAbschliessen={beenden}
              />
            )}
          </>
        ) : (
          <button className="btn primary" onClick={() => startSession.mutate({ dayId: day.id, week })}>
            {session ? 'Erneut starten' : 'Training starten'}
          </button>
        )}
      </div>

      {/* Kein eigener Abstand: die Übungskarten bringen ihren Rand selbst
          mit (.ueb bzw. .ueb:not(.auf) in global.css). */}
      <div style={{ ...cssVars({ '--i': 2 }), marginTop: 14 }}>
        {day.exercises.map((ex, i) => (
          <ExerciseBlock
            key={ex.id}
            planTyp={plan.typ}
            exercise={ex}
            nummer={i + 1}
            sets={setsByExercise.get(ex.id) ?? []}
            week={week}
            laeuft={laeuft}
            aufklappen={saetzeOffen}
            muskelgruppen={muskelgruppen}
            plate={plan.plate ?? 2.5}
            alleSaetzeJemals={alleSaetzeJemals}
            plan={plan}
          />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {neueUebung ? (
          <NeueUebungForm
            planTyp={plan.typ}
            muskelgruppen={muskelgruppen}
            onAbbrechen={() => setNeueUebung(false)}
            onAnlegen={werte => {
              // Nicht auf den Server warten: offline pausiert die Mutation,
              // das Formular bliebe sonst stehen. Die ID entsteht hier.
              createExercise.mutate({
                id: neueId(),
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
          <GymModeAP
            plan={plan}
            day={day}
            week={week}
            setsByExercise={setsByExercise}
            alleSaetzeJemals={alleSaetzeJemals}
            session={session}
            onClose={() => setGymOffen(false)}
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
  onAnlegen: (w: { name: string; scheme: string; rest: string; note: string; bench_slot: BenchSlot | null; muscle_group: string | null }) => void
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
            onClick={() => onAnlegen({ name: name.trim(), scheme, rest: formatPause(restMin), note: '', bench_slot: benchSlot, muscle_group: muscleGroup })}
          >
            Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}

function ExerciseBlock({
  planTyp,
  exercise,
  nummer,
  sets,
  week,
  laeuft,
  aufklappen,
  muskelgruppen,
  plate,
  alleSaetzeJemals,
  plan,
}: {
  planTyp: Plan['typ']
  exercise: Exercise
  /** Platz in der Tagesreihenfolge, 1-basiert — steht im Nummernkreis. */
  nummer: number
  sets: LoggedSet[]
  week: number
  muskelgruppen: string[]
  laeuft: boolean
  /** Von außen angestoßenes Aufklappen (Rückkehr aus dem Gym-Modus). Danach
      bleibt das Auf- und Zuklappen wieder ganz beim Nutzer. */
  aufklappen: boolean
  plate: number
  alleSaetzeJemals: LoggedSet[]
  plan: Plan
}) {
  const [auf, setAuf] = useState(aufklappen)
  // Abgeleiteter Zustand beim Rendern nachgezogen — dasselbe Muster wie
  // sonst in dieser Datei, statt eines Effekts mit zusätzlichem Durchlauf.
  const [letzteVorgabe, setLetzteVorgabe] = useState(aufklappen)
  if (aufklappen !== letzteVorgabe) {
    setLetzteVorgabe(aufklappen)
    if (aufklappen) setAuf(true)
  }
  const [einstellungen, setEinstellungen] = useState(false)
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false)
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()
  const upsertSet = useUpsertSet()
  const deleteSetM = useDeleteSet()

  const soll = setsOf(exercise.scheme)
  const ok = sets.filter(s => s.done).length
  const fertig = sets.length > 0 && ok >= Math.min(soll, sets.length) && ok >= soll
  const naechstePosition = sets.length ? Math.max(...sets.map(s => s.position)) + 1 : 0
  const bankdruecken = istBankdruecken(exercise)
  const anteil = soll > 0 ? Math.min(1, ok / soll) : 0
  const letzteEinheit = letzteEinheitFuerUebung(exercise.id, alleSaetzeJemals, week)

  return (
    <div className={'ueb' + (auf ? ' auf' : '') + (fertig ? ' fertig' : '') + (bankdruecken ? ' bank' : '')}>
      {/* Zugeklappt ist jede Übung nur eine Zeile hoch — Nummer, Name, die
          wichtigsten Vorgaben als Marken und der Satzstand. Alles Weitere
          erscheint erst beim Aufklappen. */}
      <div className="ueb-leiste">
        <button className="ueb-kopf" aria-expanded={auf} onClick={() => setAuf(a => !a)}>
          <span className="ueb-nr">{nummer}</span>
          <span className="ueb-titel">
            <b>{exercise.name}</b>
            {/* Zugeklappt nur das Schema: auf einem Handy bleiben neben
                Nummer, Satzstand und Pfeil keine 150 px für vier Marken —
                sie liefen bloß in die Ausblendkante. Pause, Bank und
                Muskelgruppe kommen beim Aufklappen dazu. */}
            <span className="ueb-meta">
              {exercise.scheme && <em className="mk schema">{exercise.scheme}</em>}
              {auf && exercise.rest && <em className="mk">Pause {exercise.rest}</em>}
              {auf && exercise.bench_slot && <em className="mk">Bank {exercise.bench_slot === 'd1' ? 'schwer' : 'leicht'}</em>}
              {auf && exercise.muscle_group && <em className="mk">{exercise.muscle_group}</em>}
            </span>
          </span>
          <span className={'ueb-fort' + (fertig ? ' voll' : '')}>
            {ok}
            <i>/{soll}</i>
          </span>
          <span className="ueb-pfeil">
            <svg viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      </div>
      <div className="ueb-fortschritt">
        <i style={{ width: `${(anteil * 100).toFixed(0)}%` }} />
      </div>

      {auf && (
        <div className="ueb-koerper geoeffnet">
          <div className={'setkopf' + (bankdruecken ? '' : ' ohne-rpe')}>
            <span>#</span>
            <span>Gewicht</span>
            <span>Wdh.</span>
            {bankdruecken && <span>RPE</span>}
            <span style={{ textAlign: 'center' }}>1RM</span>
            <span style={{ textAlign: 'center' }}>OK</span>
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
                onChange={patch => {
                  upsertSet.mutate({ exercise_id: exercise.id, week, position: s.position, ...patch })
                  // Satz 1 einer Übung: Gewicht/Wdh. für die übrigen Sätze
                  // mitziehen, solange die noch genau auf dem Stand von
                  // Satz 1 vor dieser Änderung stehen (anfangs beide leer).
                  // Ein manuell abweichend bearbeiteter Satz bleibt danach
                  // unabhängig — er "hört auf mitzuziehen", statt weiter
                  // überschrieben zu werden.
                  if (s.position === 0 && (patch.kg !== undefined || patch.reps !== undefined)) {
                    const neuKg = patch.kg !== undefined ? patch.kg : s.kg
                    const neuReps = patch.reps !== undefined ? patch.reps : s.reps
                    sets.forEach(other => {
                      if (other.position === 0 || other.kg !== s.kg || other.reps !== s.reps) return
                      upsertSet.mutate({ exercise_id: exercise.id, week, position: other.position, kg: neuKg, reps: neuReps })
                    })
                  }
                }}
                onDelete={() => deleteSetM.mutate(s.id)}
              />
            ))}
          </div>
          <LetzteEinheitPanel saetze={letzteEinheit} label={wochenLabel(letzteEinheit[0]?.week ?? week, plan)} />
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
            <button
              className="rowbtn einst"
              aria-pressed={einstellungen}
              title="Einstellungen der Übung"
              aria-label="Einstellungen der Übung"
              onClick={() => setEinstellungen(e => !e)}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          </div>

          {/* Selten Gebrauchtes liegt hinter dem Zahnrad: die geöffnete
              Übung zeigt sonst nur ihre Sätze. */}
          {einstellungen && (
            <div className="ueb-einst">
              <label className="ueb-einst-feld">
                <span>Notiz</span>
                <input
                  className="inp"
                  placeholder="z. B. Griffbreite, Sitzposition"
                  defaultValue={exercise.note ?? ''}
                  onBlur={e => updateExercise.mutate({ id: exercise.id, patch: { note: e.target.value } })}
                />
              </label>
              {planTyp === 'bench' && (
                <div className="ueb-einst-feld">
                  <span>Bank-Zuordnung · steuert die Aufwärmsätze</span>
                  <div className="ueb-einst-reihe">
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
                </div>
              )}
              {muskelgruppen.length > 0 && (
                <label className="ueb-einst-feld">
                  <span>Muskelgruppe · fürs Wochenvolumen</span>
                  <select
                    className="inp"
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
                </label>
              )}
              <div className="ueb-einst-reihe">
                {loeschenBestaetigen ? (
                  <>
                    <button className="btn ghost sm" onClick={() => setLoeschenBestaetigen(false)}>
                      Abbrechen
                    </button>
                    <button className="btn sm danger" onClick={() => deleteExercise.mutate(exercise.id)}>
                      Wirklich löschen
                    </button>
                  </>
                ) : (
                  <button className="btn sm danger" onClick={() => setLoeschenBestaetigen(true)}>
                    Übung löschen
                  </button>
                )}
              </div>
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

  const rm = satzE1rm(set.kg, set.reps, set.rpe)

  return (
    <div className={'setline' + (set.done ? ' ok' : '') + (zeigtRpe ? '' : ' ohne-rpe')}>
      <span className="nr">{set.position + 1}</span>
      <ZahlEingabe wert={set.kg} werte={kgWerte} titel="Gewicht" einheit="kg" className="mono kgw" leerOption onWahl={kg => onChange({ kg })} />
      <ZahlEingabe wert={set.reps} werte={REP_WERTE} titel="Wiederholungen" className="mono repw" leerOption onWahl={reps => onChange({ reps })} />
      {zeigtRpe && <ZahlEingabe wert={set.rpe} werte={RPE_WERTE} titel="RPE" className="mono rpew" leerOption onWahl={rpe => onChange({ rpe })} />}
      <span className="rm">{rm != null ? Math.round(rm) : '—'}</span>
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
