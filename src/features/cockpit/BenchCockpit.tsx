import { useNavigate } from 'react-router-dom'
import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, startInfo, wochenPensum } from './calc'
import { KennzahlBand } from './widgets'
import { AuswertungenHinweis } from './AuswertungenHinweis'
import { StartCard } from './StartCard'
import { tagFarbe } from '../training/dayColor'
import { CountUp } from '../../components/CountUp'
import { baseE1RM } from '../bench/calc'
import { gesamtWochenVolumen } from '../volume/calc'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  week: number
  setsByExercise: Map<string, LoggedSet[]>
  /** Wird seit dem Umzug der Auswertungen in den Statistik-Tab hier
      nicht mehr ausgewertet, bleibt aber Teil der Schnittstelle: Die
      CockpitPage reicht beiden Cockpits dieselben Angaben. */
  allSets: LoggedSet[]
  sessions: TrainingSession[]
}

export function BenchCockpit({ plan, days, week, setsByExercise, sessions }: Props) {
  const navigate = useNavigate()
  const tag = naechsterTag(days, setsByExercise)

  const e1 = baseE1RM(plan)

  const wochenTonnage = days.reduce((a, d) => a + tonnageOf((d.exercises.map(ex => setsByExercise.get(ex.id) ?? [])).flat()), 0)
  const gesamtVolumen = gesamtWochenVolumen(days, setsByExercise)
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

      {/* Die Auswertungen liegen jetzt im Statistik-Tab. Hier standen sie
          dreifach verpackt — hinter einem Aufklapper, darin eine Kachel
          mit einer Zahl, die eigentliche Grafik erst in einem Vollbild
          dahinter. Das Cockpit behält, was vor dem Training zählt: was
          ansteht und die Kennzahlen der Woche. */}
      <div style={{ ...cssVars({ '--i': 3 }), marginBottom: 14 }}>
        <AuswertungenHinweis />
      </div>
    </>
  )
}
