import { useState } from 'react'
import type { Plan } from '../../types/db'
import { useUpdatePlan } from '../plans/queries'
import { baseE1RM, round } from './calc'
import { ZahlEingabe } from '../../components/ZahlRad'
import { SperrKnopf } from '../../components/SperrKnopf'

export function GoalCard({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan()
  // Nur relevant, sobald ein Ziel existiert (siehe unten) — bewusst vor dem
  // frühen Return oben deklariert, Hooks brauchen dieselbe Reihenfolge bei
  // jedem Rendern. Gesperrt startet jedes Ziel: man setzt es einmal und
  // ändert es selten, ein Vertipper soll es nicht versehentlich verschieben.
  const [gesperrt, setGesperrt] = useState(true)

  const jetzt = baseE1RM(plan)

  if (!plan.goal) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>
          <span className="tick" />
          1RM-Ziel
        </h3>
        <div className="row" style={{ gap: 14 }}>
          <p className="muted tiny" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            Leg ein Ziel fest, dann zeigt der Balken, wie weit du auf dem Weg dorthin bist. Als Startpunkt wird dein
            heutiges geschätztes 1RM von {jetzt} kg gesetzt.
          </p>
          <div className="field" style={{ maxWidth: 150 }}>
            <label>Ziel in kg</label>
            <ZahlEingabe
              wert={null}
              titel="1RM-Ziel"
              einheit="kg"
              nurNumpad
              className="big"
              onWahl={v => {
                if (v != null && v > 0) updatePlan.mutate({ id: plan.id, patch: { goal: round(v, 1), goal_from: jetzt } })
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const start = plan.goal_from ?? jetzt
  const spanne = plan.goal - start || 1
  const pct = Math.max(0, Math.min(100, ((jetzt - start) / spanne) * 100))
  const erreicht = jetzt >= plan.goal
  const rest = Math.max(0, plan.goal - jetzt)

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3>
        <span className="tick" />
        1RM-Ziel{erreicht ? ' — erreicht' : ''}
        <span className="spacer" />
        <SperrKnopf gesperrt={gesperrt} onToggle={() => setGesperrt(g => !g)} />
      </h3>
      {!gesperrt && (
        <div className="field" style={{ maxWidth: 150, marginBottom: 15 }}>
          <label>Neues Ziel in kg</label>
          <ZahlEingabe
            wert={plan.goal}
            titel="1RM-Ziel"
            einheit="kg"
            nurNumpad
            className="big"
            onWahl={v => {
              if (v != null && v > 0) updatePlan.mutate({ id: plan.id, patch: { goal: round(v, 1) } })
            }}
          />
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-end', gap: 18, marginBottom: 15 }}>
        <div>
          <div className="lab mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
            Aktuell
          </div>
          <div className="goalnum" style={erreicht ? { color: 'var(--good)' } : undefined}>
            {jetzt}
            <u> kg</u>
          </div>
        </div>
        <span className="spacer" />
        {erreicht ? (
          <span className="chip ok">Ziel erreicht — Zeit für ein neues</span>
        ) : (
          <span className="mono tiny" style={{ color: 'var(--ink-3)' }}>
            noch <b style={{ color: 'var(--neon)', fontSize: 15 }}>{round(rest, 1)} kg</b>
          </span>
        )}
      </div>
      <div className={'goalbar' + (erreicht ? ' done' : '')}>
        <div className="track">
          <div className="goalfill" style={{ width: `${pct.toFixed(1)}%` }} />
        </div>
        <div className={'pct' + (pct >= 22 ? '' : ' out')}>{Math.round(pct)} %</div>
      </div>
      <div className="goalends">
        <span>
          Start <b>{round(start, 1)} kg</b>
        </span>
        <span>
          Ziel <b>{round(plan.goal, 1)} kg</b>
        </span>
      </div>
      <div className="row" style={{ marginTop: 13, gap: 8 }}>
        <button className="btn sm ghost" onClick={() => updatePlan.mutate({ id: plan.id, patch: { goal_from: jetzt } })}>
          Startpunkt auf aktuell
        </button>
        <button className="btn sm ghost danger" onClick={() => updatePlan.mutate({ id: plan.id, patch: { goal: null, goal_from: null } })}>
          Ziel entfernen
        </button>
      </div>
    </div>
  )
}
