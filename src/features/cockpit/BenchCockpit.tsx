import { useNavigate } from 'react-router-dom'
import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, einheitenDaten, startInfo, wochenPensum } from './calc'
import { UebungsdauerCard, LetzteEinheitenCard, KennzahlBand, Auswertungen } from './widgets'
import { StartCard } from './StartCard'
import { tagFarbe } from '../training/dayColor'
import { DauerEinheitenCard } from './DauerEinheitenCard'
import { TonnageEinheitenCard } from './TonnageEinheitenCard'
import { SternbildCard } from './SternbildCard'
import { DruckZugCard } from './DruckZugCard'
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
  const dauerJeUebung = durchschnittsDauerJeUebung(days, sessions, allSets)

  const e1 = baseE1RM(plan)

  const wochenTonnage = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExercise.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumen = gesamtWochenVolumen(days, setsByExercise)
  const einheiten = einheitenDaten(days, sessions, allSets)
  const pensum = wochenPensum(days, sessions, week)

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

      <div style={{ ...cssVars({ '--i': 1, '--f': tag ? tagFarbe(days, tag.id) : 'var(--neon)' }), marginBottom: 14 }}>
        <StartCard
          tag={tag}
          info={startInfo(tag, sessions)}
          onStart={tag ? () => navigate('/training', { state: { autoStartDayId: tag.id } }) : undefined}
        />
      </div>

      {/* Das 1RM führt: bei einem Bankfokus-Plan ist es die Zahl, um die
          sich alles dreht. */}
      <div style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <KennzahlBand
          werte={[
            { label: '1RM', wert: <CountUp value={e1} decimals={1} />, einheit: 'kg', fuehrend: true },
            { label: 'Einheiten', wert: `${pensum.erledigt}/${pensum.geplant}` },
            { label: 'Tonnage', wert: <CountUp value={Math.round(wochenTonnage / 1000 * 10) / 10} decimals={1} />, einheit: 't' },
            { label: 'Volumen', wert: <CountUp value={gesamtVolumen} /> },
          ]}
        />
      </div>

      {/* Direkt unter den Kennzahlen: Das Verhaeltnis von Druecken zu
          Ziehen gehoert zu den Zahlen, nicht zu den Auswertungen weiter
          unten — eine Schieflage soll auffallen, ohne dass man dafür
          etwas aufklappt. */}
      <div style={{ ...cssVars({ '--i': 3 }), marginBottom: 14 }}>
        <DruckZugCard days={days} setsByExercise={setsByExercise} allSets={allSets} week={week} />
      </div>

      <div style={cssVars({ '--i': 4 })}>
        <SternbildCard punkte={einheiten} gross />
      </div>

      <div style={{ ...cssVars({ '--i': 5 }), marginTop: 12 }}>
        <Auswertungen>
          <LetzteEinheitenCard sessions={sessions} days={days} />
          <TonnageEinheitenCard punkte={einheiten} />
          <DauerEinheitenCard punkte={einheiten} />
          <UebungsdauerCard eintraege={dauerJeUebung} />
        </Auswertungen>
      </div>
    </>
  )
}
