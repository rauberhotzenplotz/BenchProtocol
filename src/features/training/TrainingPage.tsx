import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useSession, useSetsForExercises, useSessionsForDays, useAllSetsForExercises } from './queries'
import { gruppeSetsByExercise } from './calc'
import { DayListView } from './DayListView'
import { SessionView } from './SessionView'
import { PlanPicker } from '../plans/PlanPicker'

export function TrainingPage() {
  const { activePlan } = useActivePlan()
  const [offenerTag, setOffenerTag] = useState<string | null>(null)

  const { data: days } = useDays(activePlan?.id)
  const alleExerciseIds = (days ?? []).flatMap(d => d.exercises.map(ex => ex.id))
  const alleDayIds = (days ?? []).map(d => d.id)
  const week = activePlan?.week ?? 1

  const { data: alleSaetze } = useSetsForExercises(alleExerciseIds, week)
  const { data: saetzeJemals } = useAllSetsForExercises(alleExerciseIds)
  const { data: sessions } = useSessionsForDays(alleDayIds, week)
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
        session={session}
        onBack={() => setOffenerTag(null)}
      />
    )
  }

  return (
    <DayListView
      plan={activePlan}
      days={days}
      alleSaetze={alleSaetze ?? []}
      sessions={sessions ?? []}
      onOpen={setOffenerTag}
    />
  )
}
