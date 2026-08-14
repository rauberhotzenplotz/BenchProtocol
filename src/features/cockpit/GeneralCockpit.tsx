import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, trainingszeitDaten, einheitenDaten } from './calc'
import { NextWorkoutCard, TrainingszeitCard, LetzteEinheitenCard, UebungsdauerCard, KpiCard } from './widgets'
import { DauerEinheitenCard } from './DauerEinheitenCard'
import { TonnageEinheitenCard } from './TonnageEinheitenCard'
import { CountUp } from '../../components/CountUp'
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
  const t = trainingszeitDaten(sessions)
  const dauerJeUebung = durchschnittsDauerJeUebung(days, sessions, allSets)

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
  const einheiten = einheitenDaten(days, sessions, allSets)

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

      <div className="grid g3" style={{ ...cssVars({ '--i': 1 }), marginBottom: 14 }}>
        <NextWorkoutCard tag={tag} />
        <TrainingszeitCard woche={t.woche} />
        <KpiCard
          cls="c3"
          label="Tonnage letztes Training"
          value={<CountUp value={Math.round(letzteTonnage / 1000 * 10) / 10} decimals={1} />}
          unit="t"
          spark={serie.length > 1 ? serie : undefined}
        />
      </div>

      <div style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <LetzteEinheitenCard sessions={sessions} days={days} />
      </div>

      <div className="stack" style={{ ...cssVars({ '--i': 3 }), gap: 14 }}>
        <TonnageEinheitenCard punkte={einheiten} />
        <DauerEinheitenCard punkte={einheiten} />
        <UebungsdauerCard eintraege={dauerJeUebung} />
      </div>
    </>
  )
}
