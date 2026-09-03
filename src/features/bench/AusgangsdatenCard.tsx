import { useState } from 'react'
import type { Plan } from '../../types/db'
import { useUpdatePlan } from '../plans/queries'
import { ZahlEingabe } from '../../components/ZahlRad'
import { SperrKnopf } from '../../components/SperrKnopf'

/** Der Testsatz, aus dem das geschätzte 1RM (und damit jede Kilo-Vorgabe
    auf dieser Seite) berechnet wird — jederzeit nachtragbar, statt bis zum
    automatischen Blockwechsel auf einem Platzhalter sitzen zu bleiben.
    Gesperrt, solange man nicht bewusst das Schloss antippt: Gewicht,
    Wiederholungen und RPE ändert man selten, ein Vertipper hier verzerrt
    aber sofort jede andere Zahl auf der Seite. */
export function AusgangsdatenCard({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan()
  const [gesperrt, setGesperrt] = useState(plan.beruehrt)

  const setzen = (patch: Partial<Pick<Plan, 'work' | 'reps' | 'rpe'>>) => {
    updatePlan.mutate({ id: plan.id, patch: { ...patch, beruehrt: true } })
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3>
        <span className="tick" />
        Ausgangsdaten
        <span className="spacer" />
        <SperrKnopf gesperrt={gesperrt} onToggle={() => setGesperrt(g => !g)} />
      </h3>
      <div className="row" style={{ gap: 20 }}>
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Gewicht</label>
          {gesperrt ? (
            <div className="sperr-wert">
              {plan.work ?? '—'}
              <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 4 }}>kg</span>
            </div>
          ) : (
            <ZahlEingabe wert={plan.work} titel="Gewicht" einheit="kg" nurNumpad nachkomma={3} className="big" onWahl={v => setzen({ work: v })} />
          )}
        </div>
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Wiederholungen</label>
          {gesperrt ? (
            <div className="sperr-wert">{plan.reps ?? '—'}</div>
          ) : (
            <ZahlEingabe wert={plan.reps} titel="Wiederholungen" nurNumpad className="big" onWahl={v => setzen({ reps: v })} />
          )}
        </div>
        <div className="field" style={{ maxWidth: 110 }}>
          <label>RPE</label>
          {gesperrt ? (
            <div className="sperr-wert">{plan.rpe ?? '—'}</div>
          ) : (
            <ZahlEingabe wert={plan.rpe} titel="RPE" nurNumpad className="big" onWahl={v => setzen({ rpe: v })} />
          )}
        </div>
      </div>
    </div>
  )
}
