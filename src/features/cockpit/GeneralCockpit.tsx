import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, tagFortschritt } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, frequenzDaten, trainingszeitDaten } from './calc'
import { NextWorkoutCard, FrequenzCard, TrainingszeitCard, ProgressCard, LetzteEinheitenCard, KpiCard } from './widgets'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  allSets: LoggedSet[]
  sessions: TrainingSession[]
}

export function GeneralCockpit({ plan, days, week, setsByExercise, allSets, sessions }: Props) {
  const tag = naechsterTag(days, setsByExercise)
  const fortschritt = tag ? tagFortschritt(tag.exercises, setsByExercise) : null
  const f = frequenzDaten(sessions)
  const t = trainingszeitDaten(sessions)

  // Tonnage der zuletzt beendeten Einheit + eine kurze Reihe davor als Trend.
  const letzte = sessions.slice(0, 8)
  const tonnageVon = (s: TrainingSession) => {
    const tag = days.find(d => d.id === s.day_id)
    if (!tag) return 0
    const ids = tag.exercises.map(ex => ex.id)
    return tonnageOf(allSets.filter(set => ids.includes(set.exercise_id) && set.week === s.week))
  }
  const letzteTonnage = letzte.length ? tonnageVon(letzte[0]) : 0
  const serie = letzte.map(tonnageVon).reverse()

  return (
    <>
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            {plan.name} · {wochenLabel(week, plan)}
          </span>
          <h2>Cockpit</h2>
          <p>Überblick über diesen Plan — was ansteht, wie oft und wie lange du trainierst.</p>
        </div>
        <PlanPicker />
      </div>

      <div className="grid g4" style={{ ...cssVars({ '--i': 1 }), marginBottom: 14 }}>
        <NextWorkoutCard tag={tag} fortschritt={fortschritt} />
        <FrequenzCard letzte7={f.letzte7} gesamt={f.gesamt} />
        <TrainingszeitCard woche={t.woche} gesamt={t.gesamt} />
        <KpiCard
          cls="c3"
          label="Tonnage letztes Training"
          value={Math.round(letzteTonnage / 1000 * 10) / 10}
          unit="t"
          sub={letzteTonnage > 0 ? `${Math.round(letzteTonnage)} kg bewegt` : 'noch nichts geloggt'}
          spark={serie.length > 1 ? serie : undefined}
        />
      </div>

      <div className="grid g-21" style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <ProgressCard wocheLabel={wochenLabel(week, plan)} days={days} setsByExercise={setsByExercise} />
        <LetzteEinheitenCard sessions={sessions} dayNameOf={id => days.find(d => d.id === id)?.name ?? '—'} />
      </div>
    </>
  )
}
