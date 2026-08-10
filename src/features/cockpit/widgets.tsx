import type { ReactNode } from 'react'
import type { DayWithExercises } from '../training/queries'
import { tagFortschritt, type TagFortschritt } from '../training/calc'
import type { LoggedSet, TrainingSession } from '../../types/db'
import { Sparkline } from '../../components/Sparkline'

export function KpiCard({
  cls,
  label,
  value,
  unit,
  sub,
  spark,
}: {
  cls: 'c1' | 'c2' | 'c3' | 'c4'
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  spark?: number[]
}) {
  return (
    <div className={`card kpi ${cls}`}>
      <div className="lab">{label}</div>
      <div className="val">
        {value}
        {unit && <u>{unit}</u>}
      </div>
      {sub && <div className="sub">{sub}</div>}
      {spark && <Sparkline values={spark} />}
    </div>
  )
}

export function NextWorkoutCard({ tag, fortschritt }: { tag: DayWithExercises | null; fortschritt: TagFortschritt | null }) {
  return (
    <KpiCard
      cls="c1"
      label="Als Nächstes"
      value={<span style={{ fontSize: 22 }}>{tag ? tag.name : '—'}</span>}
      sub={tag && fortschritt ? `${fortschritt.geplant} Sätze` : 'noch keine Übungen angelegt'}
    />
  )
}

export function FrequenzCard({ letzte7, gesamt }: { letzte7: number; gesamt: number }) {
  return (
    <KpiCard
      cls="c2"
      label="Trainiert · letzte 7 Tage"
      value={letzte7}
      unit={letzte7 === 1 ? 'Einheit' : 'Einheiten'}
      sub={`${gesamt} insgesamt aufgezeichnet`}
    />
  )
}

export function TrainingszeitCard({ woche, gesamt }: { woche: number; gesamt: number }) {
  return (
    <KpiCard
      cls="c4"
      label="Trainingszeit · letzte 7 Tage"
      value={woche}
      unit="min"
      sub={gesamt ? `${gesamt} min insgesamt` : 'noch nichts aufgezeichnet'}
    />
  )
}

export function ProgressCard({
  wocheLabel,
  days,
  setsByExercise,
}: {
  wocheLabel: string
  days: DayWithExercises[]
  setsByExercise: Map<string, LoggedSet[]>
}) {
  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Fortschritt {wocheLabel}
      </h3>
      <div className="stack">
        {days.map(d => {
          const f = tagFortschritt(d.exercises, setsByExercise)
          const farbe = f.anteil >= 1 ? 'var(--good)' : f.anteil > 0 ? 'var(--neon)' : 'var(--surface-3)'
          return (
            <div key={d.id} className="bar-row" style={{ gridTemplateColumns: '1fr 78px' }}>
              <div>
                <div className="nm" style={{ marginBottom: 5 }}>
                  {d.name}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(f.anteil * 100).toFixed(0)}%`, background: `linear-gradient(90deg,${farbe},${farbe}88)` }} />
                </div>
              </div>
              <div className="vv">{Math.round(f.anteil * 100)} %</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LetzteEinheitenCard({ sessions, dayNameOf }: { sessions: TrainingSession[]; dayNameOf: (dayId: string) => string }) {
  const liste = sessions.slice(0, 6)
  if (!liste.length) {
    return (
      <div className="card">
        <h3>
          <span className="tick" />
          Letzte Einheiten
        </h3>
        <p className="muted tiny" style={{ padding: '22px 0', textAlign: 'center', margin: 0 }}>
          Sobald du eine Einheit beendest, steht sie hier.
        </p>
      </div>
    )
  }
  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Letzte Einheiten
      </h3>
      <div className="kalliste" style={{ maxHeight: 'none' }}>
        {liste.map(s => (
          <div key={s.id}>
            <span>{dayNameOf(s.day_id)}</span>
            <span className="dat">{new Date(s.started_at).toLocaleDateString('de-DE')}</span>
            <span className="dau">{s.minutes} min</span>
          </div>
        ))}
      </div>
    </div>
  )
}
