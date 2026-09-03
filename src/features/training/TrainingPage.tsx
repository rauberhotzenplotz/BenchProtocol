import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useSession, useSetsForExercises, useSessionsForDays, useAllSetsForExercises, useAllSessionsForDays } from './queries'
import { gruppeSetsByExercise } from './calc'
import { DayListView } from './DayListView'
import { SessionView } from './SessionView'
import { PlanPicker } from '../plans/PlanPicker'
import { standFuerWoche, standAendern, standSchreiben } from './trainingsStand'

export function TrainingPage() {
  const { activePlan } = useActivePlan()
  // Kommt man aus dem Cockpit über "Als Nächstes" hierher, steckt die
  // Zieltag-ID im Navigations-State — einmalig als Startwert übernehmen,
  // damit ein späteres manuelles Öffnen desselben Tages nicht erneut den
  // Gym-Modus aufreißt.
  const location = useLocation()
  const autoStartDayId = (location.state as { autoStartDayId?: string } | null)?.autoStartDayId
  const [offenerTag, setOffenerTag] = useState<string | null>(() => autoStartDayId ?? null)
  const [autoStartGym, setAutoStartGym] = useState(() => !!autoStartDayId)

  // Den zuletzt offenen Tag wieder aufmachen. Genau daran fehlte es, wenn
  // Android die WebView im Hintergrund weggeräumt hatte — man stand wieder
  // in der Tagesliste statt in der laufenden Einheit (siehe
  // trainingsStand.ts).
  //
  // Abgeleitet beim Rendern statt im useState-Startwert: Der Plan (und
  // damit die Woche, gegen die der gemerkte Stand geprüft wird) steht beim
  // ersten Render noch nicht zwangsläufig fest. Im Startwert wäre die
  // Prüfung dann gegen Woche 1 gelaufen und die Wiederherstellung still
  // ausgefallen. Genau einmal, danach gehört die Auswahl dem Nutzer.
  const [wiederhergestellt, setWiederhergestellt] = useState(!!autoStartDayId)
  if (!wiederhergestellt && activePlan) {
    setWiederhergestellt(true)
    const stand = standFuerWoche(activePlan.week)
    if (stand) setOffenerTag(stand.dayId)
  }

  const { data: days } = useDays(activePlan?.id)
  const alleExerciseIds = (days ?? []).flatMap(d => d.exercises.map(ex => ex.id))
  const alleDayIds = (days ?? []).map(d => d.id)
  const week = activePlan?.week ?? 1

  // Plan-ID als Cache-Bereich (siehe useSetsForExercises) — dadurch bleibt
  // der Schlüssel stabil, auch wenn Übungen dazukommen oder wegfallen.
  const bereich = activePlan?.id ?? 'ohne-plan'
  const { data: alleSaetze } = useSetsForExercises(alleExerciseIds, week, bereich)
  const { data: saetzeJemals } = useAllSetsForExercises(alleExerciseIds, bereich)
  const { data: sessions } = useSessionsForDays(alleDayIds, week, bereich)
  const { data: sessionenJemals } = useAllSessionsForDays(alleDayIds, bereich)
  const offenerTagDaten = days?.find(d => d.id === offenerTag)
  const { data: session } = useSession(offenerTag ?? undefined, week)

  if (!activePlan) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <h2>Training</h2>
            <p>Noch kein Plan vorhanden.</p>
          </div>
          <PlanPicker />
        </div>
      </section>
    )
  }

  if (!days) return null

  /** Tag öffnen/schließen und den Stand mitschreiben. Beim Schließen
      fällt der gemerkte Gym-Zustand mit weg — wer bewusst zurück in die
      Tagesliste geht, will beim nächsten Start auch dort landen. */
  const tagOeffnen = (dayId: string | null) => {
    setOffenerTag(dayId)
    if (dayId) standAendern({ dayId, woche: week })
    else standSchreiben(null)
  }

  if (offenerTagDaten) {
    return (
      <SessionView
        plan={activePlan}
        day={offenerTagDaten}
        week={week}
        setsByExercise={gruppeSetsByExercise(alleSaetze ?? [])}
        alleSaetzeJemals={saetzeJemals ?? []}
        alleSaetzeJemalsBereit={saetzeJemals !== undefined}
        session={session}
        onBack={() => tagOeffnen(null)}
        autoStartGym={autoStartGym}
        onAutoStartConsumed={() => setAutoStartGym(false)}
      />
    )
  }

  return (
    <DayListView
      plan={activePlan}
      days={days}
      alleSaetze={alleSaetze ?? []}
      sessions={sessions ?? []}
      alleSessionenJemals={sessionenJemals ?? []}
      alleSaetzeJemals={saetzeJemals ?? []}
      onOpen={tagOeffnen}
    />
  )
}
