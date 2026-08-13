import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { setsOf, letzterSatz, aufwaermPlan, istBankdruecken, tonnageOf } from './calc'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { useUpsertSet, useEndSession } from './queries'
import { useBenchProgression, benchRowsFor, useAutoAdvanceBlock } from '../bench/queries'
import { benchLoad } from '../bench/calc'
import { GymRing } from '../../components/GymRing'
import { SatzQuittung } from './SatzQuittung'
import { GymFertig } from './GymFertig'

function zielWdh(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)/i)
  return m ? +m[1] : 8
}

interface Props {
  plan: Plan
  day: DayWithExercises
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  alleSaetzeJemals: LoggedSet[]
  alleSaetzeJemalsBereit: boolean
  session: TrainingSession | null | undefined
  onClose: () => void
}

export function GymMode({ plan, day, week, setsByExercise, alleSaetzeJemals, alleSaetzeJemalsBereit, session, onClose }: Props) {
  const upsertSet = useUpsertSet()
  const endSession = useEndSession()
  const autoAdvanceBlock = useAutoAdvanceBlock()
  const restTimer = useRestTimer()
  const { data: progression } = useBenchProgression(plan.id)
  const [uebIdx, setUebIdx] = useState(0)
  const [satzIdx, setSatzIdx] = useState(0)
  const [aufgewaermt, setAufgewaermt] = useState<Set<string>>(new Set())
  const [fertig, setFertig] = useState(false)
  // Zählt hoch statt umzuschalten: hakt man zwei Sätze schnell nacheinander
  // ab, erzwingt der neue Wert über key= einen Neuaufbau, damit die
  // Quittung von vorn läuft statt die erste Bewegung weiterlaufen zu lassen.
  const [quittung, setQuittung] = useState(0)
  // Muss stabil bleiben: die Quittung räumt sich per Zeitgeber selbst ab,
  // und während der Pause rendert der Timer im Sekundentakt neu. Ein bei
  // jedem Rendern neu erzeugter Rückruf würde den Zeitgeber ständig neu
  // aufziehen.
  const quittungFertig = useCallback(() => setQuittung(0), [])

  // Solange der Gym-Modus offen ist, übernimmt er selbst die große
  // Pausenanzeige — die kleine schwebende Leiste bleibt aus.
  useEffect(() => {
    restTimer.setGymActive(true)
    return () => restTimer.setGymActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mounten/Unmounten schalten, nicht bei jeder Timer-Änderung
  }, [])

  // Die Bank-Progression kennt das für diese Woche vorgesehene Gewicht/
  // Schema unabhängig von der Historie — wichtig direkt nach einem Block-
  // abschluss, wenn die alten Sätze gelöscht wurden und die Historie noch
  // leer ist. Ohne gesetzte Bank-Zuordnung, aber erkennbarem Namen, wird
  // der schwere Slot (d1) angenommen — dieselbe Erkennung wie fürs
  // Aufwärmen, damit beides zusammenpasst.
  const progressionZeileFuer = (ex: Exercise) => {
    if (!progression) return undefined
    const slot = ex.bench_slot ?? (istBankdruecken(ex) ? 'd1' : null)
    return slot ? benchRowsFor(progression, slot).find(r => r.week === week) : undefined
  }
  const sollFuer = (ex: Exercise) => {
    const zeile = progressionZeileFuer(ex)
    return setsOf(zeile ? zeile.scheme : ex.scheme)
  }

  const uebungen = day.exercises
  const exercise = uebungen[Math.min(uebIdx, uebungen.length - 1)]
  const sets = setsByExercise.get(exercise.id) ?? []
  const progressionZeile = progressionZeileFuer(exercise)
  const soll = sollFuer(exercise)
  const aktuellerSatz = sets.find(s => s.position === satzIdx)
  const vorschlag = letzterSatz(exercise.id, alleSaetzeJemals)
  const vorschlagKg = progressionZeile ? benchLoad(plan, progressionZeile) : (vorschlag?.kg ?? null)
  const vorschlagReps = progressionZeile ? zielWdh(progressionZeile.scheme) : (vorschlag?.reps ?? null)

  const [kg, setKg] = useState(() => aktuellerSatz?.kg ?? vorschlagKg ?? 0)
  const [reps, setReps] = useState(() => aktuellerSatz?.reps ?? vorschlagReps ?? zielWdh(exercise.scheme))
  const [rpe, setRpe] = useState(() => aktuellerSatz?.rpe ?? vorschlag?.rpe ?? 0)

  // Beim Wechsel auf einen anderen Satz/Übung die Eingabefelder neu vorbelegen
  // — und außerdem, sobald Historie bzw. Bank-Progression nach dem Mounten
  // fertig geladen sind: ohne das bliebe eine vor dem ersten Render noch
  // leere Vorbelegung (Gewicht 0) für immer stehen, auch nachdem die Daten
  // eingetroffen sind, weil useState() seinen Startwert nur einmal liest.
  const bereit = alleSaetzeJemalsBereit && (!istBankdruecken(exercise) || progression != null)
  const schluessel = `${exercise.id}|${satzIdx}|${bereit}`
  const [letzterSchluessel, setLetzterSchluessel] = useState(schluessel)
  if (schluessel !== letzterSchluessel) {
    setLetzterSchluessel(schluessel)
    setKg(aktuellerSatz?.kg ?? vorschlagKg ?? 0)
    setReps(aktuellerSatz?.reps ?? vorschlagReps ?? zielWdh(exercise.scheme))
    setRpe(aktuellerSatz?.rpe ?? vorschlag?.rpe ?? 0)
  }

  const gesamtGeplant = uebungen.reduce((a, ex) => a + sollFuer(ex), 0)
  const bisHierGeplant = uebungen.slice(0, uebIdx).reduce((a, ex) => a + sollFuer(ex), 0) + satzIdx
  const anteil = gesamtGeplant ? Math.min(1, bisHierGeplant / gesamtGeplant) : 0

  const istLetzterSatz = satzIdx + 1 >= soll && uebIdx + 1 >= uebungen.length

  const naechster = () => {
    if (satzIdx + 1 < soll) {
      setSatzIdx(satzIdx + 1)
    } else if (uebIdx + 1 < uebungen.length) {
      setUebIdx(uebIdx + 1)
      setSatzIdx(0)
    } else {
      setFertig(true)
    }
  }

  const erledigt = () => {
    upsertSet.mutate({
      exercise_id: exercise.id,
      week,
      position: satzIdx,
      kg,
      reps,
      rpe: rpe || null,
      done: true,
      done_at: new Date().toISOString(),
    })
    setQuittung(n => n + 1)
    // Vor dem letzten Satz keine Pause mehr anstoßen — danach kommt ohnehin
    // die Abschluss-Übersicht, nicht die nächste Übung.
    if (!istLetzterSatz) {
      const sek = pauseSekunden(exercise.rest)
      if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    }
    naechster()
  }

  const beenden = () => {
    if (session) endSession.mutate({ id: session.id, startedAt: session.started_at })
    if (plan.typ === 'bench') autoAdvanceBlock.mutate(plan.id)
    onClose()
  }

  const plate = plan.plate ?? 2.5

  // Aufwärmen: vor dem ersten Satz einer Übung, wenn sie entweder an die
  // Bank-Progression gekoppelt ist, ein schweres Gewicht hat oder als
  // erste Übung der Einheit drankommt (siehe aufwaermPlan) — einmal je
  // Übung. Bezieht sich auf das tatsächlich vorbelegte Arbeitsgewicht,
  // nicht auf ein fixes 1RM, damit die Leiter mit der Woche mitwächst.
  const warmSaetze = aufwaermPlan(istBankdruecken(exercise), kg, uebIdx === 0, plate)
  const zeigtAufwaermen = satzIdx === 0 && warmSaetze.length > 0 && !aufgewaermt.has(exercise.id)

  // Alle vier Bildschirme teilen sich dieselbe Hülle (Schließen-Knopf,
  // Inhaltsrahmen). Hier entsteht nur der Inhalt — gerendert wird einmal
  // weiter unten. Dadurch liegt auch die Satz-Quittung an einer Stelle,
  // statt in jedem Zweig wiederholt zu werden.
  let inhalt: ReactNode

  if (fertig) {
    // Letzter Satz erledigt: kurze Übersicht statt direkt zu schließen —
    // von hier aus wahlweise die Einheit auch gleich beenden.
    // Nicht tagFortschritt() — die zählt Sätze über das statische Schema
    // der Übung, hier soll dieselbe (ggf. Progressions-abhängige) Anzahl
    // gelten, die der Gym-Modus selbst schon für "soll" verwendet hat.
    const geplant = uebungen.reduce((a, ex) => a + sollFuer(ex), 0)
    const abgehakt = uebungen.reduce((a, ex) => a + (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length, 0)
    const tonnage = uebungen.reduce((a, ex) => a + tonnageOf(setsByExercise.get(ex.id) ?? []), 0)
    inhalt = <GymFertig geplant={geplant} erledigt={abgehakt} tonnage={tonnage} onWeiter={onClose} onBeenden={beenden} />
  } else if (restTimer.label != null) {
    // Pause: solange ein Timer läuft (oder gerade fertig ist und noch
    // ausgeblendet wird), zeigt der Gym-Modus großflächig denselben Ring wie
    // die kleine Leiste sonst — "derselbe Timer, nur im Vollbild".
    inhalt = (
      <>
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
      </>
    )
  } else if (zeigtAufwaermen) {
    inhalt = (
      <>
        <div className="gym-kopf">
          <div className="gym-fort">Vor den Arbeitssätzen</div>
          <div className="gym-ueb">{exercise.name}</div>
        </div>
        <div className="gym-warm">
          <div className="gym-wtitel">Aufwärmen</div>
          <div className="gym-wliste">
            {warmSaetze.map((s, i) => (
              <div key={s.label} className="gym-wzeile">
                <span className="nr">{i + 1}</span>
                <span className="pct">{s.label}</span>
                <span className="kg">
                  {s.kg}
                  <em>kg</em>
                </span>
                <span className="wdh">× {s.wdh}</span>
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
      </>
    )
  } else {
    inhalt = (
      <>
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
      </>
    )
  }

  return (
    <div className="gym">
      <button className="gym-zu" onClick={onClose} aria-label="Gym-Modus verlassen">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="gym-inhalt">{inhalt}</div>

      {quittung > 0 && <SatzQuittung key={quittung} onEnde={quittungFertig} />}
    </div>
  )
}
