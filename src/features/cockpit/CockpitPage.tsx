import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useSetsForExercises, useAllSetsForExercises, useAllSessionsForDays } from '../training/queries'
import { gruppeSetsByExercise } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { GeneralCockpit } from './GeneralCockpit'
import { BenchCockpit } from './BenchCockpit'

export function CockpitPage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const exerciseIds = (days ?? []).flatMap(d => d.exercises.map(ex => ex.id))
  const dayIds = (days ?? []).map(d => d.id)
  const week = activePlan?.week ?? 1

  const { data: saetzeWoche } = useSetsForExercises(exerciseIds, week)
  const { data: alleSaetze } = useAllSetsForExercises(exerciseIds)
  const { data: sessions } = useAllSessionsForDays(dayIds)

  if (!activePlan) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <h2>Cockpit</h2>
            <p>Leg deinen ersten Trainingsplan an, um loszulegen.</p>
          </div>
          <PlanPicker />
        </div>
      </section>
    )
  }

  if (!days) return null

  const setsByExercise = gruppeSetsByExercise(saetzeWoche ?? [])

  return (
    <section className="view on frisch">
      {activePlan.typ === 'bench' ? (
        <BenchCockpit
          plan={activePlan}
          days={days}
          week={week}
          setsByExercise={setsByExercise}
          allSets={alleSaetze ?? []}
          sessions={sessions ?? []}
        />
      ) : (
        <GeneralCockpit
          plan={activePlan}
          days={days}
          week={week}
          setsByExercise={setsByExercise}
          allSets={alleSaetze ?? []}
          sessions={sessions ?? []}
        />
      )}
    </section>
  )
}
