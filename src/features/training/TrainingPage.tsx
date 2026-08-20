import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useSession, useSetsForExercises, useSessionsForDays, useAllSetsForExercises, useAllSessionsForDays } from './queries'
import { gruppeSetsByExercise } from './calc'
import { DayListView } from './DayListView'
import { SessionView } from './SessionView'
import { PlanPicker } from '../plans/PlanPicker'

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
        onBack={() => setOffenerTag(null)}
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
      onOpen={setOffenerTag}
    />
  )
}
