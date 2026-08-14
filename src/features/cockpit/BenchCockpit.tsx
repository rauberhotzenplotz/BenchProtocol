import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, trainingszeitDaten, einheitenDaten } from './calc'
import { NextWorkoutCard, TrainingszeitCard, UebungsdauerCard, KpiCard } from './widgets'
import { DauerEinheitenCard } from './DauerEinheitenCard'
import { TonnageEinheitenCard } from './TonnageEinheitenCard'
import { SternbildCard } from './SternbildCard'
import { CountUp } from '../../components/CountUp'
import { baseE1RM } from '../bench/calc'
import { gesamtWochenVolumen } from '../volume/calc'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  allSets: LoggedSet[]
  sessions: TrainingSession[]
}

export function BenchCockpit({ plan, days, week, setsByExercise, allSets, sessions }: Props) {
  const tag = naechsterTag(days, setsByExercise)
  const t = trainingszeitDaten(sessions)
  const dauerJeUebung = durchschnittsDauerJeUebung(days, sessions, allSets)

  const e1 = baseE1RM(plan)

  const wochenTonnage = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExercise.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumen = gesamtWochenVolumen(days, setsByExercise)
  const einheiten = einheitenDaten(days, sessions, allSets)

  return (
    <>
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            Block {plan.block ?? 1} · {wochenLabel(week, plan)}
          </span>
          <h2>Cockpit</h2>
          <p>Alles, was du vor der Einheit wissen musst.</p>
        </div>
        <PlanPicker />
      </div>

      <div className="grid g3" style={{ ...cssVars({ '--i': 1 }), marginBottom: 14 }}>
        <NextWorkoutCard tag={tag} />
        <TrainingszeitCard woche={t.woche} />
        <KpiCard cls="c1" label="Geschätztes 1RM" value={<CountUp value={e1} decimals={1} />} unit="kg" />
        <KpiCard cls="c3" label={`Tonnage ${wochenLabel(week, plan).split(' ·')[0]}`} value={<CountUp value={Math.round(wochenTonnage / 1000 * 10) / 10} decimals={1} />} unit="t" />
        <KpiCard cls="c4" label="Wochenvolumen" value={<CountUp value={gesamtVolumen} />} unit="Sätze" />
      </div>

      <div className="stack" style={{ ...cssVars({ '--i': 2 }), marginTop: 14, gap: 14 }}>
        <SternbildCard punkte={einheiten} />
        <TonnageEinheitenCard punkte={einheiten} />
        <DauerEinheitenCard punkte={einheiten} />
        <UebungsdauerCard eintraege={dauerJeUebung} />
      </div>
    </>
  )
}
