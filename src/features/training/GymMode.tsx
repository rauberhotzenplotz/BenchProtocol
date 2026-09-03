import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { setsOf, letzterSatz, aufwaermPlan, istBankdruecken, tonnageOf, satzE1rm, letzteEinheitFuerUebung, wochenLabel, blockWoche } from './calc'
import { LetzteEinheitPanel } from './LetzteEinheitPanel'
import { pauseSekunden, autoPauseAn } from './pause'
import { useRestTimer } from './rest-timer-context'
import { useUpsertSet, useEndSession } from './queries'
import { useBenchProgression, benchRowsFor } from '../bench/queries'
import { benchLoad } from '../bench/calc'
import { GymRing } from '../../components/GymRing'
import { zeitText } from '../../lib/zeit'
import { GymUebungsWahl } from '../../components/GymUebungsWahl'
import { SessionMenu } from './SessionMenu'
import { SatzQuittung } from './SatzQuittung'
import { GymFertig } from './GymFertig'
import { Supernova } from './Supernova'
import { istRekord } from './rekord'
import { vibrieren, SATZ_ERLEDIGT, TRAINING_FERTIG } from '../../lib/haptik'

function zielWdh(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)/i)
  return m ? +m[1] : 8
}

/** Wo weitermachen: die erste Übung/Position, die noch nicht abgehakt ist
    — oder der Abschluss, wenn schon alles erledigt ist. Wird nur beim
    ersten Aufbau von GymMode ausgewertet (siehe useState-Lazy-
    Initializer dort), nicht bei jeder Änderung an den Sätzen — sonst
    würde ein frisch gesetzter Haken den Gym-Modus mitten in der Bewegung
    weiterspringen lassen. Setzt voraus, dass es mindestens eine Übung
    gibt (Gym-Modus öffnet ohnehin nur dann, siehe SessionView.tsx). */
function ersteOffenePosition(
  uebungen: Exercise[],
  setsByExercise: Map<string, LoggedSet[]>,
  sollFuer: (ex: Exercise) => number,
): { uebIdx: number; satzIdx: number; fertig: boolean } {
  for (let ui = 0; ui < uebungen.length; ui++) {
    const sets = setsByExercise.get(uebungen[ui].id) ?? []
    const soll = sollFuer(uebungen[ui])
    for (let si = 0; si < soll; si++) {
      if (!sets.find(s => s.position === si)?.done) {
        return { uebIdx: ui, satzIdx: si, fertig: false }
      }
    }
  }
  return { uebIdx: uebungen.length - 1, satzIdx: 0, fertig: true }
}

/** Wo genau man in der Übungsliste steht — wird bei SessionView gehalten,
    nicht in GymMode selbst, damit Schließen und Wiederöffnen des
    Gym-Modus an derselben Stelle weitergeht (siehe initialPosition unten). */
export interface GymPosition {
  uebIdx: number
  satzIdx: number
  fertig: boolean
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
  /** Verlässt den Gym-Modus und klappt in der Einheit die Sätze auf, damit
      man einen versehentlich gesetzten Haken gleich wieder lösen kann. Die
      Einheit läuft dabei weiter — es wird nichts neu gestartet. */
  onPruefen: () => void
  /** Zuletzt bekannte Position aus einem vorherigen Aufenthalt im
      Gym-Modus dieser Einheit — null beim allerersten Öffnen (dann wird
      die erste offene Position aus den Sätzen bestimmt). */
  initialPosition: GymPosition | null
  /** Meldet jede Positionsänderung an SessionView, damit sie beim nächsten
      Öffnen wieder als initialPosition hereinkommt. */
  onPositionChange: (pos: GymPosition) => void
}

export function GymMode({
  plan,
  day,
  week,
  setsByExercise,
  alleSaetzeJemals,
  alleSaetzeJemalsBereit,
  session,
  onClose,
  onPruefen,
  initialPosition,
  onPositionChange,
}: Props) {
  const upsertSet = useUpsertSet()
  const endSession = useEndSession()
  const restTimer = useRestTimer()
  const { data: progression } = useBenchProgression(plan.id)

  // Die Bank-Progression kennt das für diese Woche vorgesehene Gewicht/
  // Schema unabhängig von der Historie — wichtig direkt nach einem Block-
  // abschluss, wenn die alten Sätze gelöscht wurden und die Historie noch
  // leer ist. Ohne gesetzte Bank-Zuordnung, aber erkennbarem Namen, wird
  // der schwere Slot (d1) angenommen — dieselbe Erkennung wie fürs
  // Aufwärmen, damit beides zusammenpasst.
  const progressionZeileFuer = (ex: Exercise) => {
    if (!progression) return undefined
    const slot = ex.bench_slot ?? (istBankdruecken(ex) ? 'd1' : null)
    return slot ? benchRowsFor(progression, slot).find(r => r.week === blockWoche(week)) : undefined
  }
  const sollFuer = (ex: Exercise) => {
    const zeile = progressionZeileFuer(ex)
    return setsOf(zeile ? zeile.scheme : ex.scheme)
  }

  const uebungen = day.exercises

  // Wo weitermachen: erst die von SessionView gemerkte Position (voriger
  // Aufenthalt im Gym-Modus dieser Einheit, auch nach manuellem
  // Übungswechsel), sonst die erste noch offene Position aus den Sätzen.
  // Nur einmal beim Aufbau ausgewertet (Lazy-Initializer), nicht bei jeder
  // Satzänderung — sonst risse ein frisch gesetzter Haken mitten aus der
  // laufenden Bewegung.
  const [start] = useState(() => initialPosition ?? ersteOffenePosition(uebungen, setsByExercise, sollFuer))
  const [uebIdx, setUebIdx] = useState(start.uebIdx)
  const [satzIdx, setSatzIdx] = useState(start.satzIdx)
  const [aufgewaermt, setAufgewaermt] = useState<Set<string>>(new Set())
  const [fertig, setFertig] = useState(start.fertig)
  const [uebWahlOffen, setUebWahlOffen] = useState(false)

  // sollFuer() rechnet ohne geladene Bank-Progression mit dem statischen
  // Übungsschema statt der Wochenvorgabe — bei einem frischen Seitenaufruf
  // ist die Progression im allerersten Rendern oft noch nicht da. War das
  // beim Bestimmen von "start" oben der Fall, einmalig nachbessern, sobald
  // sie eintrifft. Nur, solange der Nutzer in der Zwischenzeit nicht schon
  // selbst weitergeklickt hat — sonst überschriebe die Korrektur echten
  // Fortschritt. Und nur beim allerersten Öffnen (initialPosition null) —
  // eine gemerkte Position aus einem vorigen Aufenthalt (ggf. nach
  // manuellem Übungswechsel) soll dieselbe Korrektur nicht wieder
  // rückgängig machen. Abgeleiteter Zustand direkt beim Rendern, nicht in
  // einem Effekt: sonst bliebe die falsche Startposition für einen
  // zusätzlichen Render-Zyklus sichtbar.
  const progressionNoetig = uebungen.some(ex => ex.bench_slot != null || istBankdruecken(ex))
  const positionBereit = initialPosition != null || !progressionNoetig || progression != null
  const [positionKorrigiert, setPositionKorrigiert] = useState(positionBereit)
  if (!positionKorrigiert && positionBereit) {
    setPositionKorrigiert(true)
    const nochUnveraendert = uebIdx === start.uebIdx && satzIdx === start.satzIdx && fertig === start.fertig
    if (nochUnveraendert) {
      const echt = ersteOffenePosition(uebungen, setsByExercise, sollFuer)
      if (echt.uebIdx !== uebIdx) setUebIdx(echt.uebIdx)
      if (echt.satzIdx !== satzIdx) setSatzIdx(echt.satzIdx)
      if (echt.fertig !== fertig) setFertig(echt.fertig)
    }
  }

  // Jede Positionsänderung an SessionView melden, damit sie beim nächsten
  // Öffnen als initialPosition wieder hereinkommt (siehe Props oben) —
  // Schließen und Wiederöffnen soll immer an der richtigen Stelle
  // weitergehen, auch nach einem manuellen Übungswechsel. Ein Effekt ist
  // hier richtig: es wird kein eigener State gesetzt, nur ein Elternteil
  // benachrichtigt (dasselbe Muster wie restTimer.setGymActive unten).
  useEffect(() => {
    onPositionChange({ uebIdx, satzIdx, fertig })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPositionChange ist eine in SessionView per useCallback stabile Referenz
  }, [uebIdx, satzIdx, fertig])

  // Zählt hoch statt umzuschalten: hakt man zwei Sätze schnell nacheinander
  // ab, erzwingt der neue Wert über key= einen Neuaufbau, damit die
  // Quittung von vorn läuft statt die erste Bewegung weiterlaufen zu lassen.
  const [quittung, setQuittung] = useState(0)
  // Muss stabil bleiben: die Quittung räumt sich per Zeitgeber selbst ab,
  // und während der Pause rendert der Timer im Sekundentakt neu. Ein bei
  // jedem Rendern neu erzeugter Rückruf würde den Zeitgeber ständig neu
  // aufziehen.
  const quittungFertig = useCallback(() => setQuittung(0), [])

  // Wie die Quittung über einen Zähler, damit zwei Rekorde kurz
  // hintereinander die Nova neu starten statt sie weiterlaufen zu lassen.
  const [nova, setNova] = useState<{ nr: number; text: string } | null>(null)
  // Alle in dieser Einheit erzielten Bestleistungen, nicht nur die letzte —
  // der Abschlussbildschirm hält sie fest (siehe GymFertig).
  const [erzielteRekorde, setErzielteRekorde] = useState<string[]>([])
  // Ref statt State: löst kein eigenes Rendern aus, wird nur von
  // novaFertig gelesen, wenn die Supernova durchgelaufen ist.
  const wartetAufNova = useRef(false)
  const novaFertig = useCallback(() => {
    setNova(null)
    if (wartetAufNova.current) {
      wartetAufNova.current = false
      setFertig(true)
    }
  }, [])

  // Solange der Gym-Modus offen ist, übernimmt er selbst die große
  // Pausenanzeige — die kleine schwebende Leiste bleibt aus.
  useEffect(() => {
    restTimer.setGymActive(true)
    return () => restTimer.setGymActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mounten/Unmounten schalten, nicht bei jeder Timer-Änderung
  }, [])

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
    // Eine bereits abgelaufene (ggf. schon negativ zählende) Pause räumt
    // sich beim Weitergehen ab — sie gehörte zum Satz, den man gerade
    // verlässt. Eine frische, noch laufende Pause (secondsLeft > 0) bleibt
    // unangetastet: erledigt() ruft naechster() direkt nach dem Start der
    // nächsten Pause auf, die soll natürlich weiterlaufen.
    if (restTimer.label != null && restTimer.secondsLeft <= 0) restTimer.stop()
    if (satzIdx + 1 < soll) {
      setSatzIdx(satzIdx + 1)
    } else if (uebIdx + 1 < uebungen.length) {
      setUebIdx(uebIdx + 1)
      setSatzIdx(0)
    } else {
      setFertig(true)
    }
  }

  // Übungswechsel außer der Reihe: springt zum ersten noch offenen Satz der
  // gewählten Übung — oder zu Satz 1, falls dort schon alles abgehakt ist
  // (dann sieht man wenigstens den letzten Stand statt irgendeine Lücke).
  const uebungWaehlen = (index: number) => {
    const ex = uebungen[index]
    const exSets = setsByExercise.get(ex.id) ?? []
    const exSoll = sollFuer(ex)
    let offenePosition = 0
    for (let si = 0; si < exSoll; si++) {
      if (!exSets.find(s => s.position === si)?.done) {
        offenePosition = si
        break
      }
    }
    setUebIdx(index)
    setSatzIdx(offenePosition)
    setFertig(false)
  }

  const uebwahlEintraege = uebungen.map(ex => ({
    id: ex.id,
    name: ex.name,
    erledigt: (setsByExercise.get(ex.id) ?? []).filter(s => s.done).length,
    soll: sollFuer(ex),
  }))

  const erledigt = () => {
    // Vor dem Speichern prüfen: danach stünde der neue Satz selbst schon
    // in der Historie und schlüge damit seinen eigenen Bestwert nie.
    // Nur wenn die Historie geladen ist — sonst sähe jeder Satz nach dem
    // allerersten aus und es käme nie eine Nova.
    const rekord = alleSaetzeJemalsBereit && istRekord(kg, reps, alleSaetzeJemals, exercise.id)

    upsertSet.mutate({
      exercise_id: exercise.id,
      week,
      position: satzIdx,
      kg,
      reps,
      rpe: istBankdruecken(exercise) && rpe ? rpe : null,
      done: true,
      done_at: new Date().toISOString(),
    })
    if (rekord) {
      const text = `${exercise.name} · ${kg} kg × ${reps}`
      setErzielteRekorde(r => [...r, text])
      setNova(n => ({ nr: (n?.nr ?? 0) + 1, text }))
      vibrieren(TRAINING_FERTIG)
    } else {
      vibrieren(SATZ_ERLEDIGT)
    }
    setQuittung(n => n + 1)

    if (istLetzterSatz) {
      // Eine noch offene (ggf. schon negativ zählende) Pause vom vorigen
      // Satz gehört jetzt zu keiner Übung mehr — sonst zählte die
      // schwebende Leiste außerhalb des Gym-Modus munter weiter, obwohl
      // die Einheit längst fertig ist.
      restTimer.stop()
      // Bei einer Bestleistung im letzten Satz soll die Supernova ihren
      // eigenen Moment bekommen, statt gleichzeitig mit dem Abschluss-
      // bildschirm (eigener Haken, eigene Funken, eigene Zahlen) um
      // Aufmerksamkeit zu konkurrieren — der Abschluss wartet, bis
      // novaFertig() feuert. Ohne Rekord gibt es nichts, worauf zu warten wäre.
      if (rekord) wartetAufNova.current = true
      else setFertig(true)
      return
    }

    // Vor dem letzten Satz keine Pause mehr anstoßen — danach kommt ohnehin
    // die Abschluss-Übersicht, nicht die nächste Übung.
    const sek = pauseSekunden(exercise.rest)
    if (autoPauseAn() && sek > 0) restTimer.start(sek, exercise.name)
    naechster()
  }

  const beenden = () => {
    restTimer.stop()
    // Der automatische Block-Check läuft nicht mehr hier, sondern im
    // registrierten onSuccess von endSession (src/lib/offlineMutations.ts)
    // — vorher lief er ohne auf endSession zu warten, also potenziell noch
    // vor dessen Bestätigung; jetzt garantiert erst danach, auch offline.
    if (session)
      endSession.mutate({
        id: session.id,
        startedAt: session.started_at,
        endedAt: new Date().toISOString(),
        dayId: day.id,
        week,
        planId: plan.id,
        planTyp: plan.typ,
      })
    onClose()
  }

  const plate = plan.plate ?? 2.5

  // Aufwärmen: vor dem ersten Satz einer Übung, ausschließlich beim
  // Bankdrücken (siehe aufwaermPlan) — einmal je Übung. Das Arbeitsgewicht
  // kommt direkt aus Satz/Vorschlag statt aus dem kg-State: der State wird
  // erst über den schluessel-Effekt oben nachgezogen, sobald Historie bzw.
  // Bank-Progression geladen sind, und stünde beim allerersten Render sonst
  // noch auf 0 — die Aufwärmleiter müsste sonst auf einen zweiten Render
  // warten, statt gleich beim Öffnen zu erscheinen.
  const warmSaetze = aufwaermPlan(istBankdruecken(exercise), aktuellerSatz?.kg ?? vorschlagKg ?? kg, plate)
  const zeigtAufwaermen = satzIdx === 0 && warmSaetze.length > 0 && !aufgewaermt.has(exercise.id)

  // Übungsname im Kopf: bei mehr als einer Übung ein Auslöser für den
  // Wechsel außer der Reihe (z. B. Bank belegt, Gerät gerade frei) statt
  // eines starren Textes. Einmal gebaut, weil derselbe Kopf in zwei der
  // vier Bildschirme auftaucht (Aufwärmen und Arbeitssatz).
  const uebTitel =
    uebungen.length > 1 ? (
      <button type="button" className="gym-ueb wahl" onClick={() => setUebWahlOffen(true)}>
        <span className="gym-ueb-text">{exercise.name}</span>
        <svg className="gym-ueb-pfeil" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    ) : (
      <div className="gym-ueb">{exercise.name}</div>
    )

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
    inhalt = (
      <GymFertig
        geplant={geplant}
        erledigt={abgehakt}
        tonnage={tonnage}
        rekorde={erzielteRekorde}
        onPruefen={onPruefen}
        onBeenden={beenden}
      />
    )
  } else if (restTimer.label != null && restTimer.secondsLeft > 0) {
    // Pause: nur solange sie noch läuft. Ist die Zeit um, springt der
    // Gym-Modus sofort zum Satz weiter (nächster Zweig unten) statt auf
    // ein "Weiter" zu warten — der Countdown läuft dort grau und negativ
    // weiter, bis der Satz abgehakt ist.
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
          {uebTitel}
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
    const rm = satzE1rm(kg, reps, istBankdruecken(exercise) ? rpe || null : null)
    const letzteEinheit = letzteEinheitFuerUebung(exercise.id, alleSaetzeJemals, week)
    inhalt = (
      <>
        <div className="gym-kopf">
          <div className="gym-fort">
            Übung {uebIdx + 1} von {uebungen.length} · Satz {satzIdx + 1} von {soll}
          </div>
          {uebTitel}
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
          {istBankdruecken(exercise) && (
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
          )}
          {rm != null && (
            <div className="gym-rm">
              geschätztes 1RM <b>{Math.round(rm)} kg</b>
            </div>
          )}
          {restTimer.label != null && restTimer.secondsLeft <= 0 ? (
            <div className="gym-ueberzogen">
              Pause überzogen
              <b>{zeitText(restTimer.secondsLeft)}</b>
            </div>
          ) : (
            exercise.rest && <div className="gym-hinweis">Pause {exercise.rest}</div>
          )}
        </div>

        <LetzteEinheitPanel saetze={letzteEinheit} label={wochenLabel(letzteEinheit[0]?.week ?? week, plan)} />

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

      {session && (
        <SessionMenu
          session={session}
          dayId={day.id}
          week={week}
          exerciseIds={uebungen.map(ex => ex.id)}
          onAbschliessen={beenden}
          menuAlign="left"
          wrapStyle={{ position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', left: 12, zIndex: 2 }}
        />
      )}

      <div className="gym-inhalt">{inhalt}</div>

      {quittung > 0 && <SatzQuittung key={quittung} onEnde={quittungFertig} />}
      {nova && <Supernova key={nova.nr} text={nova.text} onEnde={novaFertig} />}
      <GymUebungsWahl
        offen={uebWahlOffen}
        uebungen={uebwahlEintraege}
        aktiverIndex={uebIdx}
        onWahl={uebungWaehlen}
        onSchliessen={() => setUebWahlOffen(false)}
      />
    </div>
  )
}
