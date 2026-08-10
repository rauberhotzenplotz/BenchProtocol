import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { useCreateDay } from './queries'
import { tagFortschritt, gruppeSetsByExercise, wochenLabel } from './calc'
import { WeekControl } from './WeekControl'
import { PlanPicker } from '../plans/PlanPicker'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  alleSaetze: LoggedSet[]
  sessions: TrainingSession[]
  onOpen: (dayId: string) => void
}

export function DayListView({ plan, days, alleSaetze, sessions, onOpen }: Props) {
  const setsByExercise = gruppeSetsByExercise(alleSaetze)
  const createDay = useCreateDay(plan.id)

  const gesamt = days.reduce(
    (a, d) => {
      const f = tagFortschritt(d.exercises, setsByExercise)
      return { erledigt: a.erledigt + f.erledigt, geplant: a.geplant + f.geplant, tonnage: a.tonnage + f.tonnage }
    },
    { erledigt: 0, geplant: 0, tonnage: 0 },
  )

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">{plan.typ === 'bench' ? `Block ${plan.block ?? 1}` : wochenLabel(plan.week, plan)}</span>
          <h2>Training</h2>
          <p>Tippe auf einen Tag, um die Einheit zu öffnen.</p>
        </div>
        <PlanPicker />
        <WeekControl plan={plan} />
      </div>

      <div className="tagliste" style={cssVars({ '--i': 2 })}>
        {days.map((d, i) => {
          const f = tagFortschritt(d.exercises, setsByExercise)
          const laeuft = sessions.some(s => s.day_id === d.id && !s.ended_at)
          const rec = sessions.find(s => s.day_id === d.id && s.ended_at)
          const begonnen = laeuft || f.erledigt > 0 || !!rec
          return (
            <button key={d.id} className={'tagkarte' + (f.fertig ? ' fertig' : '')} onClick={() => onOpen(d.id)}>
              <div className="tnr">Tag {i + 1}</div>
              <h4>{d.name}</h4>
              <div className="tsub">{d.sub}</div>
              <div className="tzeile">
                <span>{d.exercises.length} Übungen</span>
                <span>·</span>
                <span>{f.geplant} Sätze</span>
              </div>
              {begonnen && (
                <>
                  <div className="tbalken">
                    <div className="tfill" style={{ width: `${(f.anteil * 100).toFixed(0)}%` }} />
                  </div>
                  <div className="tzeile">
                    {laeuft ? (
                      <span className="chip neon">läuft gerade</span>
                    ) : f.fertig ? (
                      <span className="chip ok">fertig{rec?.minutes ? ` · ${rec.minutes} min` : ''}</span>
                    ) : (
                      <span className="chip">
                        {f.erledigt} von {f.geplant} Sätzen
                      </span>
                    )}
                  </div>
                </>
              )}
              <div className="tstart">
                {laeuft ? 'Weiter trainieren' : begonnen ? 'Einheit öffnen' : 'Training starten'}
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
            </button>
          )
        })}
        <button
          className="tagkarte neu"
          aria-label="Trainingstag hinzufügen"
          onClick={() => createDay.mutate({ name: `Tag ${days.length + 1}`, sortOrder: days.length })}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Tag hinzufügen</span>
        </button>
      </div>

      <div className="row" style={{ ...cssVars({ '--i': 3 }), marginTop: 16 }}>
        <span className="mono tiny muted">
          {wochenLabel(plan.week, plan)}: {gesamt.erledigt} von {gesamt.geplant} Sätzen · {Math.round(gesamt.tonnage)} kg bewegt
        </span>
      </div>
    </section>
  )
}
