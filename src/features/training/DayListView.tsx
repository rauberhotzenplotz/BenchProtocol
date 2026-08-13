import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { useCreateDay, useSkipSession } from './queries'
import { tagFortschritt, gruppeSetsByExercise, wochenLabel } from './calc'
import { WeekControl } from './WeekControl'
import { PlanPicker } from '../plans/PlanPicker'
import { DateStrip } from './DateStrip'
import { tagFarbe } from './dayColor'
import { cssVars } from '../../lib/style'

interface Props {
  plan: Plan
  days: DayWithExercises[]
  alleSaetze: LoggedSet[]
  sessions: TrainingSession[]
  alleSessionenJemals: TrainingSession[]
  alleSaetzeJemals: LoggedSet[]
  onOpen: (dayId: string) => void
}

export function DayListView({ plan, days, alleSaetze, sessions, alleSessionenJemals, alleSaetzeJemals, onOpen }: Props) {
  const setsByExercise = gruppeSetsByExercise(alleSaetze)
  const createDay = useCreateDay(plan.id)
  const skipSession = useSkipSession()

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

      <div style={{ marginBottom: 14 }}>
        <DateStrip plan={plan} days={days} sessions={alleSessionenJemals} alleSaetze={alleSaetzeJemals} />
      </div>

      <div className="tagliste" style={cssVars({ '--i': 2 })}>
        {days.map((d, i) => {
          const f = tagFortschritt(d.exercises, setsByExercise)
          const laeuft = sessions.some(s => s.day_id === d.id && !s.ended_at)
          const rec = sessions.find(s => s.day_id === d.id && s.ended_at && s.status === 'completed')
          const uebersprungen = sessions.some(s => s.day_id === d.id && s.status === 'skipped')
          const begonnen = laeuft || f.erledigt > 0 || !!rec
          return (
            <div
              key={d.id}
              className={'tagkarte' + (f.fertig ? ' fertig' : '')}
              style={cssVars({ '--f': tagFarbe(days, d.id) })}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(d.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen(d.id)}
            >
              <div className="tnr">Tag {i + 1}</div>
              <h4>{d.name}</h4>
              <div className="tsub">{d.sub}</div>
              <div className="tzeile">
                <span>{d.exercises.length} Übungen</span>
                <span>·</span>
                <span>{f.geplant} Sätze</span>
              </div>
              {uebersprungen && !begonnen ? (
                <div className="tzeile">
                  <span className="chip mute">übersprungen</span>
                </div>
              ) : (
                begonnen && (
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
                )
              )}
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <div className="tstart" style={{ flex: 1 }}>
                  {laeuft ? 'Weiter trainieren' : begonnen ? 'Einheit öffnen' : uebersprungen ? 'Doch noch trainieren' : 'Training starten'}
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
                {!begonnen && !uebersprungen && (
                  <button
                    className="btn sm ghost"
                    onClick={e => {
                      e.stopPropagation()
                      skipSession.mutate({ dayId: d.id, week: plan.week })
                    }}
                  >
                    Überspringen
                  </button>
                )}
              </div>
            </div>
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
