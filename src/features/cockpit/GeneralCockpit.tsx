import { useNavigate } from 'react-router-dom'
import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { tonnageOf, wochenLabel, durchschnittsDauerJeUebung } from '../training/calc'
import { PlanPicker } from '../plans/PlanPicker'
import { naechsterTag, trainingszeitDaten, einheitenDaten, ruhetage, startInfo, wochenPensum } from './calc'
import { LetzteEinheitenCard, UebungsdauerCard, KennzahlBand, Auswertungen } from './widgets'
import { StartCard } from './StartCard'
import { tagFarbe } from '../training/dayColor'
import { DauerEinheitenCard } from './DauerEinheitenCard'
import { TonnageEinheitenCard } from './TonnageEinheitenCard'
import { SternbildCard } from './SternbildCard'
import { DruckZugCard } from './DruckZugCard'
import { MuskelHeatmap } from './MuskelHeatmap'
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
  const einheiten = einheitenDaten(days, sessions, allSets)
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

      {/* Direkt unter den Kennzahlen: Das Verhältnis von Drücken zu
          Ziehen gehört zu den Zahlen, nicht zu den Auswertungen weiter
          unten — eine Schieflage soll auffallen, ohne dass man dafür
          etwas aufklappt. */}
      <div style={{ ...cssVars({ '--i': 3 }), marginBottom: 14 }}>
        <MuskelHeatmap days={days} allSets={allSets} />
      </div>

      <div style={{ ...cssVars({ '--i': 4 }), marginBottom: 14 }}>
        <DruckZugCard days={days} setsByExercise={setsByExercise} allSets={allSets} week={week} />
      </div>

      <div style={cssVars({ '--i': 5 })}>
        <SternbildCard punkte={einheiten} gross />
      </div>

      <div style={{ ...cssVars({ '--i': 6 }), marginTop: 12 }}>
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
