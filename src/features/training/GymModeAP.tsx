import { useEffect, useState } from 'react'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { useUpsertSet, useDeleteSet, useEndSession, useUpdateExercise } from './queries'
import {
  setsOf,
  tonnageOf,
  letzteEinheitFuerUebung,
  satzE1rm,
  wochenLabel,
  istBankdruecken,
  anzeigeName,
  schemaMitSaetzen,
} from './calc'
import { istRekord } from './rekord'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { useBenchProgression, benchRowsFor } from '../bench/queries'
import { benchLoad } from '../bench/calc'
import { ZahlRad } from '../../components/ZahlRad'
import { GymRing } from '../../components/GymRing'
import { GymFertig } from './GymFertig'
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

/** Gym-Modus: die ganze Übung steht als Tabelle da, eine Zeile ist die
    aktuelle. Anders als früher ist aber jede Zeile sofort bedienbar —
    Gewicht, Wiederholungen und Haken brauchen keinen vorherigen Tap auf
    die Zeile mehr. Das Antippen wählt nur noch aus, welche Zeile als
    "aktuell" hervorgehoben ist.

    Sätze lassen sich hier ergänzen und wieder entfernen. Weil das den
    Plan betrifft und nicht nur die heutige Einheit, wird beim Beenden
    gefragt, ob die neue Satzanzahl dauerhaft ins Schema der Übung soll.

    Eigener CSS-Namensraum (.ap-*), damit sich nichts mit dem übrigen
    Stylesheet beißt. */
export function GymModeAP({ plan, day, week, setsByExercise, alleSaetzeJemals, session, onClose }: Props) {
  const upsertSet = useUpsertSet()
  const deleteSet = useDeleteSet()
  const updateExercise = useUpdateExercise()
  const endSession = useEndSession()
  const restTimer = useRestTimer()
  const { data: progression } = useBenchProgression(plan.id)

  // Bank-Progression schlägt vor, welches Gewicht/Schema diese Woche für
  // "Bank schwer"/"Bank leicht" gilt — unabhängig davon, was zuletzt
  // geloggt wurde. Ohne gesetzte Bank-Zuordnung, aber erkennbarem Namen
  // ("Bankdrücken"), wird der schwere Slot (d1) angenommen.
  const progressionZeileFuer = (ex: Exercise) => {
    if (!progression) return undefined
    const slot = ex.bench_slot ?? (istBankdruecken(ex) ? 'd1' : null)
    return slot ? benchRowsFor(progression, slot).find(r => r.week === week) : undefined
  }
  const sollFuer = (ex: Exercise) => {
    const zeile = progressionZeileFuer(ex)
    return setsOf(zeile ? zeile.scheme : ex.scheme)
  }

  // Solange der Gym-Modus offen ist, übernimmt er selbst die Pausenanzeige
  // — die schwebende RestTimerBar bleibt aus, sonst poppte sie bei jedem
  // Abhaken zusätzlich ein.
  useEffect(() => {
    restTimer.setGymActive(true)
    return () => restTimer.setGymActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mounten/Unmounten schalten, nicht bei jeder Timer-Änderung
  }, [])

  const uebungen = day.exercises
  const [uebIdx, setUebIdx] = useState(0)
  const exercise = uebungen[Math.min(uebIdx, uebungen.length - 1)]
  const progressionZeile = progressionZeileFuer(exercise)
  const sets = setsByExercise.get(exercise.id) ?? []

  // Von Hand ergänzte bzw. entfernte Zeilen je Übung, als Abweichung vom
  // Schema. Nur für diese Einheit — ob daraus ein dauerhafter Planeintrag
  // wird, entscheidet der Nutzer beim Beenden.
  const [zusatz, setZusatz] = useState<Record<string, number>>({})
  const zeilenAnzahlFuer = (ex: Exercise) => {
    const geloggt = (setsByExercise.get(ex.id) ?? []).length
    return Math.max(1, sollFuer(ex) + (zusatz[ex.id] ?? 0), geloggt)
  }
  const zeilenAnzahl = zeilenAnzahlFuer(exercise)

  // Aktive Zeile: erster noch nicht abgehakter Satz der Übung.
  const ersterOffener = (() => {
    for (let i = 0; i < zeilenAnzahl; i++) if (!sets.find(s => s.position === i)?.done) return i
    return zeilenAnzahl - 1
  })()
  const [aktivRoh, setAktiv] = useState<number | null>(null)
  const aktiv = Math.min(aktivRoh ?? ersterOffener, zeilenAnzahl - 1)

  const letzteEinheit = letzteEinheitFuerUebung(exercise.id, alleSaetzeJemals, week)
  // Die letzte Einheit steht nicht mehr dauerhaft unter der Tabelle,
  // sondern nur auf Wunsch — der Platz gehört der Pausenuhr.
  const [historieOffen, setHistorieOffen] = useState(false)

  const [radOffen, setRadOffen] = useState<{ feld: 'kg' | 'reps'; position: number } | null>(null)

  /** Was in einer Zeile steht, bevor etwas eingetragen wurde: erst die
      Bank-Progression dieser Woche (die weiß um Steigerung und Deload),
      sonst die letzte Einheit, sonst das Schema. */
  const werteFuer = (position: number) => {
    const satz = sets.find(s => s.position === position) ?? null
    const vorschlag = letzteEinheit.find(s => s.position === position) ?? letzteEinheit[letzteEinheit.length - 1] ?? null
    const kg = satz?.kg ?? (progressionZeile ? benchLoad(plan, progressionZeile) : vorschlag?.kg) ?? null
    const reps =
      satz?.reps ?? (progressionZeile ? zielWdh(progressionZeile.scheme) : vorschlag?.reps) ?? zielWdh(exercise.scheme)
    return { satz, kg, reps }
  }

  const plate = plan.plate ?? 2.5
  const kgWerte = zahlenBereich(plate, 300, plate)

  const schreibe = (position: number, patch: { kg?: number | null; reps?: number | null; done?: boolean; done_at?: string | null }) => {
    upsertSet.mutate({ exercise_id: exercise.id, week, position, ...patch })
  }

  // Alle in dieser Einheit erzielten Bestleistungen — der
  // Abschlussbildschirm hält sie fest.
  const [erzielteRekorde, setErzielteRekorde] = useState<string[]>([])

  // Fortschritt über die ganze Einheit, nicht nur die offene Übung —
  // Grundlage für "war das der letzte Satz?" (dann keine Pause mehr) und
  // für den hervorgehobenen Beenden-Knopf.
  const saetzeGeplant = uebungen.reduce((a, ex) => a + zeilenAnzahlFuer(ex), 0)
  const saetzeErledigt = uebungen.reduce(
    (a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length,
    0,
  )
  const allesErledigt = saetzeErledigt >= saetzeGeplant

  const abhaken = (position: number) => {
    const { satz, kg, reps } = werteFuer(position)
    const jetztErledigt = !satz?.done
    if (jetztErledigt && istRekord(kg, reps, alleSaetzeJemals, exercise.id)) {
      setErzielteRekorde(r => [...r, `${anzeigeName(exercise, plan, week)} · ${zahl(kg)} kg × ${zahl(reps, 0)}`])
    }
    schreibe(position, {
      kg,
      reps,
      done: jetztErledigt,
      done_at: jetztErledigt ? new Date().toISOString() : null,
    })
    if (!jetztErledigt) return
    vibrieren(SATZ_ERLEDIGT)

    // War das der letzte offene Satz der ganzen Einheit, ist die Pause
    // sinnlos — es kommt nichts mehr, worauf man sich erholen müsste.
    // saetzeErledigt zählt den Stand vor diesem Haken, deshalb +1.
    const warLetzterSatz = saetzeErledigt + 1 >= saetzeGeplant
    if (warLetzterSatz) {
      // Eine noch laufende Pause vom vorletzten Satz mit abräumen.
      restTimer.stop()
      return
    }

    const sek = pauseSekunden(exercise.rest)
    if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    // Weiter zur nächsten offenen Zeile — innerhalb der Übung, sonst zur
    // nächsten Übung.
    if (position + 1 < zeilenAnzahl) setAktiv(position + 1)
    else if (uebIdx + 1 < uebungen.length) {
      setUebIdx(uebIdx + 1)
      setAktiv(null)
    }
  }

  const zeileHinzufuegen = () => setZusatz(z => ({ ...z, [exercise.id]: (z[exercise.id] ?? 0) + 1 }))

  /** Entfernt die letzte Zeile samt eventuell geloggtem Satz. Bewusst nur
      die letzte: eine Zeile aus der Mitte zu löschen würde alle folgenden
      Satzpositionen verschieben — viele Schreibvorgänge, die offline
      einzeln in der Warteschlange landen und dabei leicht in eine
      halbfertige Nummerierung geraten. */
  const letzteZeileEntfernen = () => {
    if (zeilenAnzahl <= 1) return
    const letzte = sets.find(s => s.position === zeilenAnzahl - 1)
    if (letzte) deleteSet.mutate(letzte.id)
    setZusatz(z => ({ ...z, [exercise.id]: (z[exercise.id] ?? 0) - 1 }))
    if (aktivRoh != null && aktivRoh >= zeilenAnzahl - 1) setAktiv(null)
  }

  // Übungen, deren Satzanzahl von ihrem Schema abweicht — nur die werden
  // beim Beenden zur Übernahme angeboten.
  const geaenderteUebungen = uebungen.filter(ex => zeilenAnzahlFuer(ex) !== sollFuer(ex))

  const [fertig, setFertig] = useState(false)
  const [planFrage, setPlanFrage] = useState(false)

  const einheitBeenden = () => {
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
  }

  const planUebernehmen = () => {
    for (const ex of geaenderteUebungen) {
      updateExercise.mutate({ id: ex.id, patch: { scheme: schemaMitSaetzen(ex.scheme, zeilenAnzahlFuer(ex)) } })
    }
    setPlanFrage(false)
    setFertig(true)
  }

  const beendenAngefordert = () => {
    if (geaenderteUebungen.length > 0) setPlanFrage(true)
    else setFertig(true)
  }

  const warmup = istBankdruecken(exercise) ? 1 : 0
  const pauseLaeuft = restTimer.label != null && restTimer.secondsLeft > 0

  if (fertig) {
    const geplant = uebungen.reduce((a, ex) => a + zeilenAnzahlFuer(ex), 0)
    const abgehakt = uebungen.reduce((a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length, 0)
    const tonnage = uebungen.reduce((a, ex) => a + tonnageOf(setsByExercise.get(ex.id) ?? []), 0)
    return (
      <div className="ap">
        <GymFertig
          geplant={geplant}
          erledigt={abgehakt}
          tonnage={tonnage}
          rekorde={erzielteRekorde}
          onPruefen={() => setFertig(false)}
          onBeenden={einheitBeenden}
        />
      </div>
    )
  }

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

      {/* Übungsstreifen: nummerierte Kacheln, die Reihenfolge und der
          aktive Zustand zählen. */}
      <div className="ap-streifen">
        {uebungen.map((ex, i) => {
          const exSets = setsByExercise.get(ex.id) ?? []
          const fertigeUebung = exSets.filter(s => s.done).length >= zeilenAnzahlFuer(ex)
          return (
            <button
              key={ex.id}
              className={'ap-kachel' + (i === uebIdx ? ' aktiv' : '') + (fertigeUebung ? ' fertig' : '')}
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
        <h1 className="ap-uebung">{anzeigeName(exercise, plan, week)}</h1>

        <div className="ap-meta">
          {exercise.muscle_group && <span>{exercise.muscle_group}</span>}
          <span>{zielWdh(progressionZeile ? progressionZeile.scheme : exercise.scheme)} Wdh</span>
          {exercise.rest && <span>Pause {exercise.rest}</span>}
        </div>

        {warmup > 0 && <div className="ap-warmup">{warmup} Warmup Satz</div>}

        {/* Die große Pausenuhr steht dort, wo früher die Historie klebte —
            im Training ist sie die Angabe, auf die man wirklich schaut. */}
        {pauseLaeuft && (
          <div className="ap-pause">
            <GymRing secondsLeft={restTimer.secondsLeft} totalSeconds={restTimer.totalSeconds} />
            <button className="ap-pause-stop" onClick={() => restTimer.stop()}>
              Pause überspringen
            </button>
          </div>
        )}

        <div className="ap-tabkopf">
          <span>#</span>
          <span>KG</span>
          <span>WDH</span>
          <span>1RM</span>
          <span />
        </div>

        {Array.from({ length: zeilenAnzahl }, (_, position) => {
          const { satz, kg, reps } = werteFuer(position)
          const istAktiv = position === aktiv
          const rm = satzE1rm(kg, reps, satz?.rpe)
          return (
            <div
              key={position}
              className={'ap-zeile' + (istAktiv ? ' aktiv' : '') + (satz?.done ? ' erledigt' : '')}
              onClick={() => setAktiv(position)}
            >
              <span className="ap-nr">
                {position + 1}
                {istAktiv && <i />}
              </span>

              {/* Jede Zeile ist sofort bedienbar — kein vorheriger Tap auf
                  die Zeile mehr nötig. */}
              <button
                className="ap-feld"
                onClick={e => {
                  e.stopPropagation()
                  setAktiv(position)
                  setRadOffen({ feld: 'kg', position })
                }}
              >
                {zahl(kg)}
              </button>
              <button
                className="ap-feld"
                onClick={e => {
                  e.stopPropagation()
                  setAktiv(position)
                  setRadOffen({ feld: 'reps', position })
                }}
              >
                {zahl(reps, 0)}
              </button>

              <span className="ap-wert">{zahl(rm)}</span>

              <button
                className={'ap-haken' + (satz?.done ? ' an' : '')}
                onClick={e => {
                  e.stopPropagation()
                  abhaken(position)
                }}
                aria-label={satz?.done ? 'Satz zurücknehmen' : 'Satz abhaken'}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              </button>
            </div>
          )
        })}

        <div className="ap-satzknoepfe">
          <button className="ap-satzbtn" onClick={zeileHinzufuegen}>
            + Satz
          </button>
          <button className="ap-satzbtn" onClick={letzteZeileEntfernen} disabled={zeilenAnzahl <= 1}>
            − Satz
          </button>
        </div>

        {letzteEinheit.length > 0 && (
          <div className="ap-historie">
            <button
              className="ap-historie-kopf"
              onClick={() => setHistorieOffen(o => !o)}
              aria-expanded={historieOffen}
            >
              <span>
                {wochenLabel(letzteEinheit[0].week, plan)} · {day.name}
              </span>
              <svg className={historieOffen ? 'auf' : ''} viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {historieOffen && (
              <>
                <div className="ap-tabkopf klein">
                  <span>#</span>
                  <span>KG</span>
                  <span>WDH</span>
                  <span>1RM</span>
                </div>
                {letzteEinheit.map(s => (
                  <div key={s.id} className="ap-hzeile">
                    <span>{s.position + 1}</span>
                    <span>{zahl(s.kg)}</span>
                    <span>{zahl(s.reps, 0)}</span>
                    <span>{zahl(satzE1rm(s.kg, s.reps, s.rpe))}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="ap-fuss">
        {/* Sind alle Sätze abgehakt, ist Beenden der nächste Schritt und
            nicht mehr der Abbruch mittendrin — deshalb größer und in Grün
            statt klein und rot. */}
        <button className={'ap-beenden' + (allesErledigt ? ' bereit' : '')} onClick={beendenAngefordert}>
          {allesErledigt ? 'Training beenden' : 'Beenden'}
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

      {/* Satzanzahl im Training geändert: einmal fragen, ob das dauerhaft
          in den Plan soll — sonst gilt es nur für heute. */}
      {planFrage && (
        <div className="ap-frage-overlay" onClick={e => e.target === e.currentTarget && setPlanFrage(false)}>
          <div className="ap-frage" role="dialog" aria-modal="true">
            <h4>Änderungen in den Plan übernehmen?</h4>
            <p className="muted tiny">
              {geaenderteUebungen.length === 1
                ? `„${geaenderteUebungen[0].name}“ hat jetzt ${zeilenAnzahlFuer(geaenderteUebungen[0])} statt ${sollFuer(geaenderteUebungen[0])} Sätze.`
                : `${geaenderteUebungen.length} Übungen haben eine andere Satzanzahl als im Plan.`}{' '}
              Ohne Übernahme gilt die Änderung nur für diese Einheit.
            </p>
            <div className="ap-frage-tasten">
              <button className="btn ghost sm" onClick={() => { setPlanFrage(false); setFertig(true) }}>
                Nur heute
              </button>
              <button className="btn primary sm" onClick={planUebernehmen}>
                In den Plan übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      <ZahlRad
        offen={radOffen?.feld === 'kg'}
        titel="Gewicht"
        werte={kgWerte}
        aktuell={radOffen ? werteFuer(radOffen.position).kg : null}
        format={String}
        einheit="kg"
        leerOption
        onWahl={kg => radOffen && schreibe(radOffen.position, { kg })}
        onSchliessen={() => setRadOffen(null)}
      />
      <ZahlRad
        offen={radOffen?.feld === 'reps'}
        titel="Wiederholungen"
        werte={REP_WERTE}
        aktuell={radOffen ? werteFuer(radOffen.position).reps : null}
        format={String}
        leerOption
        onWahl={reps => radOffen && schreibe(radOffen.position, { reps })}
        onSchliessen={() => setRadOffen(null)}
      />
    </div>
  )
}
