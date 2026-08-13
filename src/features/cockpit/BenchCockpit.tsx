import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tagFortschritt, tonnageOf, wochenLabel, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, frequenzDaten, trainingszeitDaten, einheitenDaten } from './calc'
import { NextWorkoutCard, FrequenzCard, TrainingszeitCard, UebungsdauerCard, KpiCard } from './widgets'
import { DauerEinheitenCard } from './DauerEinheitenCard'
import { TonnageEinheitenCard } from './TonnageEinheitenCard'
import { CountUp } from '../../components/CountUp'
import { useBenchProgression, benchRowsFor } from '../bench/queries'
import { useVolumeRows, totalSetsOf } from '../volume/queries'
import { baseE1RM, benchLoad } from '../bench/calc'
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
  const { data: progression } = useBenchProgression(plan.id)
  const { data: volumeRows } = useVolumeRows(plan.id)

  const tag = naechsterTag(days, setsByExercise)
  const fortschritt = tag ? tagFortschritt(tag.exercises, setsByExercise) : null
  const f = frequenzDaten(sessions)
  const t = trainingszeitDaten(sessions)
  const dauerJeUebung = durchschnittsDauerJeUebung(days, sessions, allSets)

  const e1 = baseE1RM(plan)
  const rowsD1 = progression ? benchRowsFor(progression, 'd1') : []
  const rowsD3 = progression ? benchRowsFor(progression, 'd3') : []
  const heuteD1 = rowsD1.find(r => r.week === week)
  const heuteD3 = rowsD3.find(r => r.week === week)
  const zielD1 = heuteD1 ? benchLoad(plan, heuteD1) : 0

  const wochenTonnage = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExercise.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumen = (volumeRows ?? []).reduce((a, r) => a + totalSetsOf(r), 0)
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
        <NextWorkoutCard tag={tag} fortschritt={fortschritt} />
        <FrequenzCard letzte7={f.letzte7} gesamt={f.gesamt} />
        <TrainingszeitCard woche={t.woche} gesamt={t.gesamt} />
      </div>

      <div className="grid g4" style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <KpiCard cls="c1" label="Geschätztes 1RM" value={<CountUp value={e1} decimals={1} />} unit="kg" sub={`Epley aus ${plan.work ?? 0} kg × ${plan.reps ?? 0} Wdh @ ${plan.rir ?? 0} RiR`} />
        <KpiCard
          cls="c2"
          label="Heute auf der Bank"
          value={<CountUp value={zielD1} decimals={1} />}
          unit="kg"
          sub={heuteD1 && heuteD3 ? `${heuteD1.scheme} schwer · ${heuteD3.scheme} mit Pause` : '—'}
        />
        <KpiCard cls="c3" label={`Tonnage ${wochenLabel(week, plan).split(' ·')[0]}`} value={<CountUp value={Math.round(wochenTonnage / 1000 * 10) / 10} decimals={1} />} unit="t" sub={wochenTonnage > 0 ? `${Math.round(wochenTonnage)} kg bewegt` : 'noch nichts geloggt'} />
        <KpiCard cls="c4" label="Wochenvolumen" value={<CountUp value={gesamtVolumen} />} unit="Sätze" sub={`${(volumeRows ?? []).length} Muskelgruppen erfasst`} />
      </div>

      <div className="card" style={cssVars({ '--i': 3 })}>
        <h3>
          <span className="tick" />
          Nach dem Block
        </h3>
        <ul style={{ margin: 0, paddingLeft: 17, color: 'var(--ink-2)', fontSize: 12.8, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <li>
            Schaffst du Woche 3 planmäßig, steigt das Arbeitsgewicht um <strong style={{ color: 'var(--neon)' }}>2,5 kg</strong>.
          </li>
          <li>
            Läuft Woche 3 mit deutlich mehr Reserve als geplant (Ø RPE ≤ 6,5), steigt es stattdessen um{' '}
            <strong style={{ color: 'var(--neon)' }}>5 kg</strong>.
          </li>
          <li>Schaffst du Woche 3 nicht in allen Sätzen, wiederholt sich der Block mit unverändertem Ausgangsgewicht.</li>
        </ul>
      </div>

      <div className="stack" style={{ ...cssVars({ '--i': 4 }), marginTop: 14, gap: 14 }}>
        <TonnageEinheitenCard punkte={einheiten} />
        <DauerEinheitenCard punkte={einheiten} />
        <UebungsdauerCard eintraege={dauerJeUebung} />
      </div>
    </>
  )
}
