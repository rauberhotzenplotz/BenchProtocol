import { useEffect, useState } from 'react'
import type { LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { useUpsertSet, useEndSession } from './queries'
import { setsOf, letzteEinheitFuerUebung, satzE1rm, wochenLabel, istBankdruecken } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { ZahlRad } from '../../components/ZahlRad'
import { zahlenBereich } from '../../lib/zahlen'
import { zeitText } from '../../lib/zeit'
import { vibrieren, SATZ_ERLEDIGT } from '../../lib/haptik'

const REP_WERTE = zahlenBereich(1, 30, 1)

/** Zielwiederholungen aus einem Schema wie "4 × 8" — für die Kopfzeile
    "Maschine · 8 Wdh", die bei Alpha Progression über der Satztabelle steht. */
function zielWdh(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)/i)
  return m ? +m[1] : 8
}

/** Deutsche Schreibweise mit Komma statt Punkt — die Vorlage zeigt
    "150,3" und "112,5", nicht "150.3". */
function zahl(n: number | null | undefined, nachkomma = 1): string {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: nachkomma })
}

interface Props {
  plan: Plan
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  alleSaetzeJemals: LoggedSet[]
  session: TrainingSession | null | undefined
  onClose: () => void
}

/** Gym-Modus im Aufbau von Alpha Progression, bewusst in deren Optik
    statt in unserer (Weltraum/Neon) — als Vergleichsstück, das Design
    ziehen wir später nach. Eigener CSS-Namensraum (.ap-*), damit sich
    nichts mit dem übrigen Stylesheet beißt.

    Unterschied zu unserem GymMode: dort führt die App durch genau einen
    Satz nach dem anderen (ein Satz pro Bildschirm). Hier steht die ganze
    Übung als Tabelle da, eine Zeile ist aktiv, und man hakt sie mit dem
    grünen Haken ab — man kann jederzeit jede andere Zeile antippen.

    Statt Übungsfotos (die es in unserer Datenlage nicht gibt) tragen die
    Kacheln im Streifen oben die Nummer der Übung. */
export function GymModeAP({ plan, day, week, setsByExercise, alleSaetzeJemals, session, onClose }: Props) {
  const upsertSet = useUpsertSet()
  const endSession = useEndSession()
  const restTimer = useRestTimer()

  // Solange der Gym-Modus offen ist, übernimmt der Timer-Knopf im Fuß
  // selbst die Pausenanzeige — die schwebende RestTimerBar (z-index 130,
  // liegt bewusst ÜBER dem Gym-Modus für den Fall, dass er zu ist) bleibt
  // aus. Ohne das poppte sie bei jedem "Abhaken" zusätzlich ein, sobald
  // die Pause startet — genau das sah wie ein kurzer Sprung des ganzen
  // Bildschirms aus. Gleiches Muster wie im alten GymMode.
  useEffect(() => {
    restTimer.setGymActive(true)
    return () => restTimer.setGymActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mounten/Unmounten schalten, nicht bei jeder Timer-Änderung
  }, [])

  const uebungen = day.exercises
  const [uebIdx, setUebIdx] = useState(0)
  const exercise = uebungen[Math.min(uebIdx, uebungen.length - 1)]
  const soll = setsOf(exercise.scheme)
  const sets = setsByExercise.get(exercise.id) ?? []

  // Aktive Zeile: erster noch nicht abgehakter Satz der Übung.
  const ersterOffener = (() => {
    for (let i = 0; i < soll; i++) if (!sets.find(s => s.position === i)?.done) return i
    return soll - 1
  })()
  const [aktivRoh, setAktiv] = useState<number | null>(null)
  const aktiv = aktivRoh ?? ersterOffener

  // Die Zeilen der Tabelle: geplante Satzanzahl, aufgefüllt mit dem, was
  // schon geloggt ist.
  const zeilen = Array.from({ length: Math.max(soll, sets.length) }, (_, i) => ({
    position: i,
    satz: sets.find(s => s.position === i) ?? null,
  }))

  const letzteEinheit = letzteEinheitFuerUebung(exercise.id, alleSaetzeJemals, week)

  const [radOffen, setRadOffen] = useState<'kg' | 'reps' | null>(null)
  const aktiveZeile = zeilen[aktiv]

  // Wie in der Vorlage steht in der aktiven Zeile schon etwas, bevor man
  // tippt: der Satz derselben Position aus der letzten Einheit, sonst
  // deren letzter Satz. Erst beim Abhaken wird der Vorschlag geschrieben.
  const vorschlag = letzteEinheit.find(s => s.position === aktiv) ?? letzteEinheit[letzteEinheit.length - 1] ?? null
  const aktKg = aktiveZeile?.satz?.kg ?? vorschlag?.kg ?? null
  const aktReps = aktiveZeile?.satz?.reps ?? vorschlag?.reps ?? zielWdh(exercise.scheme)

  const plate = plan.plate ?? 2.5
  const kgWerte = zahlenBereich(plate, 300, plate)

  const schreibe = (patch: { kg?: number | null; reps?: number | null; done?: boolean; done_at?: string | null }) => {
    upsertSet.mutate({ exercise_id: exercise.id, week, position: aktiv, ...patch })
  }

  const abhaken = () => {
    const jetztErledigt = !aktiveZeile?.satz?.done
    schreibe({
      kg: aktKg,
      reps: aktReps,
      done: jetztErledigt,
      done_at: jetztErledigt ? new Date().toISOString() : null,
    })
    if (!jetztErledigt) return
    vibrieren(SATZ_ERLEDIGT)
    const sek = pauseSekunden(exercise.rest)
    if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    // Weiter zur nächsten offenen Zeile — innerhalb der Übung, sonst zur
    // nächsten Übung.
    if (aktiv + 1 < soll) setAktiv(aktiv + 1)
    else if (uebIdx + 1 < uebungen.length) {
      setUebIdx(uebIdx + 1)
      setAktiv(null)
    }
  }

  const warmup = istBankdruecken(exercise) ? 1 : 0

  return (
    <div className="ap">
      <div className="ap-griff" />

      <div className="ap-kopf">
        <button className="ap-titelbtn" onClick={onClose}>
          {day.name}
          <svg viewBox="0 0 24 24">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
          </svg>
        </button>
      </div>

      {/* Übungsstreifen: bei Alpha Progression Fotos, hier nummerierte
          Kacheln — die Reihenfolge und der aktive Zustand zählen. */}
      <div className="ap-streifen">
        {uebungen.map((ex, i) => {
          const exSets = setsByExercise.get(ex.id) ?? []
          const fertig = exSets.filter(s => s.done).length >= setsOf(ex.scheme)
          return (
            <button
              key={ex.id}
              className={'ap-kachel' + (i === uebIdx ? ' aktiv' : '') + (fertig ? ' fertig' : '')}
              onClick={() => {
                setUebIdx(i)
                setAktiv(null)
              }}
              aria-label={ex.name}
              title={ex.name}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="ap-inhalt">
        <h1 className="ap-uebung">{exercise.name}</h1>

        <div className="ap-meta">
          {exercise.muscle_group && <span>{exercise.muscle_group}</span>}
          <span>{zielWdh(exercise.scheme)} Wdh</span>
          {exercise.rest && <span>Pause {exercise.rest}</span>}
        </div>

        {warmup > 0 && <div className="ap-warmup">{warmup} Warmup Satz</div>}

        <div className="ap-tabkopf">
          <span>#</span>
          <span>KG</span>
          <span>WDH</span>
          <span>1RM</span>
          <span />
        </div>

        {zeilen.map(z => {
          const istAktiv = z.position === aktiv
          const rm = satzE1rm(
            istAktiv ? aktKg : z.satz?.kg,
            istAktiv ? aktReps : z.satz?.reps,
            z.satz?.rpe,
          )
          return (
            <div
              key={z.position}
              className={'ap-zeile' + (istAktiv ? ' aktiv' : '') + (z.satz?.done ? ' erledigt' : '')}
              onClick={() => !istAktiv && setAktiv(z.position)}
            >
              <span className="ap-nr">
                {z.position + 1}
                {istAktiv && <i />}
              </span>

              {istAktiv ? (
                <>
                  <button className="ap-feld" onClick={() => setRadOffen('kg')}>
                    {zahl(aktKg)}
                  </button>
                  <button className="ap-feld" onClick={() => setRadOffen('reps')}>
                    {zahl(aktReps, 0)}
                  </button>
                </>
              ) : (
                <>
                  <span className="ap-wert">{zahl(z.satz?.kg)}</span>
                  <span className="ap-wert">{zahl(z.satz?.reps, 0)}</span>
                </>
              )}

              <span className="ap-wert">{zahl(rm)}</span>

              {istAktiv ? (
                <button
                  className={'ap-haken' + (z.satz?.done ? ' an' : '')}
                  onClick={e => {
                    e.stopPropagation()
                    abhaken()
                  }}
                  aria-label={z.satz?.done ? 'Satz zurücknehmen' : 'Satz abhaken'}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </button>
              ) : (
                <span />
              )}
            </div>
          )
        })}

        {letzteEinheit.length > 0 && (
          <div className="ap-historie">
            <div className="ap-historie-kopf">{wochenLabel(letzteEinheit[0].week, plan)} · {day.name}</div>
            <div className="ap-tabkopf klein">
              <span>#</span>
              <span>KG</span>
              <span>WDH</span>
              <span>1RM</span>
            </div>
            {letzteEinheit.map(s => {
              const rm = satzE1rm(s.kg, s.reps, s.rpe)
              return (
                <div key={s.id} className="ap-hzeile">
                  <span>{s.position + 1}</span>
                  <span>{zahl(s.kg)}</span>
                  <span>{zahl(s.reps, 0)}</span>
                  <span>{zahl(rm)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="ap-fuss">
        <button
          className="ap-beenden"
          onClick={() => {
            restTimer.stop()
            if (session) {
              endSession.mutate({
                id: session.id,
                startedAt: session.started_at,
                dayId: day.id,
                week,
                planId: plan.id,
                planTyp: plan.typ,
              })
            }
            onClose()
          }}
        >
          Beenden
        </button>

        <button
          className={'ap-timer' + (restTimer.label != null ? ' laeuft' : '')}
          onClick={() => {
            if (restTimer.label != null) restTimer.stop()
            else restTimer.start(pauseSekunden(exercise.rest) || 120, exercise.name)
          }}
        >
          {restTimer.label != null ? (
            zeitText(restTimer.secondsLeft)
          ) : (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" />
            </svg>
          )}
        </button>
      </div>

      <ZahlRad
        offen={radOffen === 'kg'}
        titel="Gewicht"
        werte={kgWerte}
        aktuell={aktKg}
        format={String}
        einheit="kg"
        leerOption
        onWahl={kg => schreibe({ kg })}
        onSchliessen={() => setRadOffen(null)}
      />
      <ZahlRad
        offen={radOffen === 'reps'}
        titel="Wiederholungen"
        werte={REP_WERTE}
        aktuell={aktReps}
        format={String}
        leerOption
        onWahl={reps => schreibe({ reps })}
        onSchliessen={() => setRadOffen(null)}
      />
    </div>
  )
}
