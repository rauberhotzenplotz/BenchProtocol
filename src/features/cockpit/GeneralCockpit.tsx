import { useNavigate } from 'react-router-dom'
import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, trainingszeitDaten, ruhetage, startInfo, wochenPensum } from './calc'
import { KennzahlBand } from './widgets'
import { AuswertungenHinweis } from './AuswertungenHinweis'
import { StartCard } from './StartCard'
import { tagFarbe } from '../training/dayColor'
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
  const navigate = useNavigate()
  const tag = naechsterTag(days, setsByExercise)
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
  const pensum = wochenPensum(days, sessions, week)
  const ruht = ruhetage(sessions)

  return (
    <>
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            {plan.name} · {wochenLabel(week, plan)}
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

      <div style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <KennzahlBand
          werte={[
            { label: 'Einheiten', wert: `${pensum.erledigt}/${pensum.geplant}`, fuehrend: true },
            { label: 'Tonnage', wert: <CountUp value={Math.round(letzteTonnage / 1000 * 10) / 10} decimals={1} />, einheit: 't' },
            { label: 'Zeit 7 T.', wert: <CountUp value={t.woche} />, einheit: 'min' },
            { label: 'Ruhetage', wert: ruht == null ? '—' : <CountUp value={ruht} /> },
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
