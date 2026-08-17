import { useNavigate } from 'react-router-dom'
import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, durchschnittsDauerJeUebung, gruppeSetsByExercise } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, trainingszeitDaten, einheitenDaten, prozentAenderung, ruhetage, startInfo, wochenPensum } from './calc'
import { TrainingszeitCard, UebungsdauerCard, KpiCard, RuhetageCard, WochenpensumCard, LetzteEinheitenCard } from './widgets'
import { StartCard } from './StartCard'
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
  const navigate = useNavigate()
  const tag = naechsterTag(days, setsByExercise)
  const t = trainingszeitDaten(sessions)
  const dauerJeUebung = durchschnittsDauerJeUebung(days, sessions, allSets)

  const e1 = baseE1RM(plan)

  const wochenTonnage = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExercise.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumen = gesamtWochenVolumen(days, setsByExercise)
  const einheiten = einheitenDaten(days, sessions, allSets)

  // Vorwoche zum Vergleich — aus den ohnehin geladenen allSets (alle
  // Wochen) herausgefiltert, statt einer eigenen Abfrage.
  const setsByExerciseVorwoche = gruppeSetsByExercise(allSets.filter(s => s.week === week - 1))
  const wochenTonnageVorwoche = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExerciseVorwoche.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumenVorwoche = gesamtWochenVolumen(days, setsByExerciseVorwoche)

  return (
    <>
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            Block {plan.block ?? 1} · {wochenLabel(week, plan)}
          </span>
          <h2>Cockpit</h2>
        </div>
        <PlanPicker />
      </div>

      <div style={{ ...cssVars({ '--i': 1 }), marginBottom: 14 }}>
        <StartCard
          tag={tag}
          info={startInfo(tag, sessions)}
          onStart={tag ? () => navigate('/training', { state: { autoStartDayId: tag.id } }) : undefined}
        />
      </div>

      <div className="kpirow" style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <KpiCard label="Geschätztes 1RM" value={<CountUp value={e1} decimals={1} />} unit="kg" />
        <WochenpensumCard {...wochenPensum(days, sessions, week)} />
        <KpiCard
          label={`Tonnage ${wochenLabel(week, plan).split(' ·')[0]}`}
          value={<CountUp value={Math.round(wochenTonnage / 1000 * 10) / 10} decimals={1} />}
          unit="t"
          deltaPct={prozentAenderung(wochenTonnage, wochenTonnageVorwoche)}
        />
        <KpiCard
          label="Wochenvolumen"
          value={<CountUp value={gesamtVolumen} />}
          unit="Sätze"
          deltaPct={prozentAenderung(gesamtVolumen, gesamtVolumenVorwoche)}
        />
        <TrainingszeitCard woche={t.woche} vorwoche={t.vorwoche} />
        <RuhetageCard tage={ruhetage(sessions)} />
      </div>

      <div className="kachelgrid" style={cssVars({ '--i': 3 })}>
        <LetzteEinheitenCard sessions={sessions} days={days} />
        <SternbildCard punkte={einheiten} />
        <TonnageEinheitenCard punkte={einheiten} />
        <DauerEinheitenCard punkte={einheiten} />
        <UebungsdauerCard eintraege={dauerJeUebung} />
      </div>
    </>
  )
}
