import { useUpdatePlan } from '../plans/queries'
import type { Plan } from '../../types/db'

/** Bankfokus-Pläne schalten zwischen den festen Slots 1–4 um, Standard-
    pläne zählen unbegrenzt weiter (siehe Cockpit/Training aus der alten
    App: dieselbe Unterscheidung, hier als eigenständige Komponente). */
export function WeekControl({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan()

  if (plan.typ === 'bench') {
    return (
      <div className="pills" role="group" aria-label="Woche wählen">
        {[1, 2, 3, 4].map(w => (
          <button
            key={w}
            className={'pill' + (w === plan.week ? ' on' : '')}
            onClick={() => updatePlan.mutate({ id: plan.id, patch: { week: w } })}
          >
            {w === 4 ? 'Deload' : `W${w}`}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      className="btn sm ghost"
      title="Nächste Woche beginnen — der Plan läuft unbegrenzt weiter"
      onClick={() => updatePlan.mutate({ id: plan.id, patch: { week: plan.week + 1 } })}
    >
      <svg viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Neue Woche
    </button>
  )
}
