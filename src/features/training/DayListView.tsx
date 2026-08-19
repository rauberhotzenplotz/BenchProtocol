import type { Plan, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { useSkipSession } from './queries'
import { tagFortschritt, gruppeSetsByExercise, wochenLabel } from './calc'
import { PlanPicker } from '../plans/PlanPicker'
import { DateStrip } from './DateStrip'
import { tagFarbe } from './dayColor'
import { cssVars } from '../../lib/style'
import { KachelKarte } from '../cockpit/KachelKarte'

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
  const skipSession = useSkipSession()

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            {plan.name} · {plan.typ === 'bench' ? `Block ${plan.block ?? 1}` : wochenLabel(plan.week, plan)}
          </span>
          <h2>Training</h2>
        </div>
        <PlanPicker />
      </div>

      <div style={{ marginBottom: 14 }}>
        <DateStrip plan={plan} days={days} sessions={alleSessionenJemals} alleSaetze={alleSaetzeJemals} />
      </div>

      <div className="tagliste" style={cssVars({ '--i': 2 })}>
        {days.map(d => {
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
              <h4>{d.name}</h4>
              <div className="tsub">{d.sub}</div>
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
              {!begonnen && !uebersprungen && (
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className="btn sm ghost"
                    onClick={e => {
                      e.stopPropagation()
                      skipSession.mutate({ dayId: d.id, week: plan.week })
                    }}
                  >
                    Überspringen
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {plan.typ === 'bench' && (
        <div className="kachelgrid" style={{ ...cssVars({ '--i': 3 }), marginTop: 16 }}>
          <KachelKarte titel="Nach dem Block" wert={plan.block ?? 1} hinweis="wie die Progression weitergeht">
            <ul style={{ margin: 0, paddingLeft: 17, color: 'var(--ink-2)', fontSize: 12.8, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <li>
                Am Ende der Deload-Woche berechnet die App dein neues 1RM automatisch aus den RPE-Werten der Wochen 1–3 auf{' '}
                <strong style={{ color: 'var(--neon)' }}>Bank schwer</strong>.
              </li>
              <li>
                Lief der Block planmäßig oder besser (Ø RPE nah am Ziel), übernimmt der nächste Block dein tatsächlich{' '}
                <strong style={{ color: 'var(--neon)' }}>bestes gemessenes 1RM</strong> aus diesem Block.
              </li>
              <li>
                War die Ermüdung höher als geplant oder fehlt eine Woche mit RPE-Eintrag, bleibt das Ausgangsgewicht{' '}
                <strong style={{ color: 'var(--neon)' }}>unverändert</strong>.
              </li>
            </ul>
          </KachelKarte>
        </div>
      )}
    </section>
  )
}
