import { useState, type ChangeEvent } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useUpdatePlan } from '../plans/queries'
import { useBenchProgression, benchRowsFor } from './queries'
import { useDays } from '../training/queries'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { baseE1RM } from './calc'
import { ProgressionTable } from './ProgressionTable'
import { GoalCard } from './GoalCard'
import { RechnerCard } from './RechnerCard'
import { cssVars } from '../../lib/style'
import type { Plan } from '../../types/db'

export function BenchPage() {
  const { activePlan } = useActivePlan()

  if (!activePlan) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <h2>Bank</h2>
          <p>Noch kein Plan vorhanden.</p>
        </div>
      </section>
    )
  }

  if (activePlan.typ !== 'bench') {
    return (
      <section className="view on frisch">
        <div className="view-head" style={cssVars({ '--i': 0 })}>
          <div>
            <span className="eyebrow">Bankdrücken-Block</span>
            <h2>Bank</h2>
          </div>
        </div>
        <div className="note" style={cssVars({ '--i': 1 })}>
          Dieser Tab ist nur verfügbar, wenn du einen Plan mit Bankfokus trainierst. „{activePlan.name}“ ist ein
          Standardplan — leg dir bei Bedarf über die Plan-Verwaltung im Training-Tab zusätzlich einen Plan mit
          Bankfokus an.
        </div>
      </section>
    )
  }

  return <BenchTab plan={activePlan} />
}

function BenchTab({ plan }: { plan: Plan }) {
  const updatePlan = useUpdatePlan()
  const { data: progression } = useBenchProgression(plan.id)
  const { data: days } = useDays(plan.id)
  const qc = useQueryClient()
  const [schliesstBlock, setSchliesstBlock] = useState(false)

  const bsp = !plan.beruehrt
  const e1 = baseE1RM(plan)

  const feldGeaendert = (key: 'work' | 'reps' | 'rir' | 'plate') => (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value.replace(',', '.'))
    if (isNaN(v) || v <= 0) return
    updatePlan.mutate({ id: plan.id, patch: { [key]: v, beruehrt: true } })
  }

  const blockAbschliessen = async () => {
    if (!days) return
    setSchliesstBlock(true)
    try {
      const exerciseIds = days.flatMap(d => d.exercises.map(ex => ex.id))
      const dayIds = days.map(d => d.id)
      if (exerciseIds.length) await supabase.from('logged_sets').delete().in('exercise_id', exerciseIds).lte('week', 4)
      if (dayIds.length) await supabase.from('sessions').delete().in('day_id', dayIds).lte('week', 4)
      await updatePlan.mutateAsync({
        id: plan.id,
        patch: { block: (plan.block ?? 1) + 1, work: Math.round(((plan.work ?? 0) + 2.5) * 10) / 10, week: 1 },
      })
      await qc.invalidateQueries({ queryKey: ['sets'] })
      await qc.invalidateQueries({ queryKey: ['sets-all'] })
      await qc.invalidateQueries({ queryKey: ['session'] })
      await qc.invalidateQueries({ queryKey: ['sessions'] })
      await qc.invalidateQueries({ queryKey: ['sessions-all'] })
    } finally {
      setSchliesstBlock(false)
    }
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">4-Wochen-Block Nr. {plan.block ?? 1}</span>
          <h2>Bankdrücken</h2>
          <p>Ändere deine Ausgangsdaten — die Kilo-Vorgaben für beide Bank-Einheiten rechnen sofort neu.</p>
        </div>
        <button className="btn primary" disabled={schliesstBlock} onClick={() => void blockAbschliessen()}>
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          Block abschließen
        </button>
      </div>

      {bsp && (
        <div className="note" style={cssVars({ '--i': 1 })}>
          Das sind Beispielwerte zur Orientierung — trag unten dein eigenes Arbeitsgewicht ein, dann rechnet der
          Block mit deinen Zahlen.
        </div>
      )}

      <GoalCard plan={plan} />

      <div className="grid g-12" style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <div className="card">
          <h3>
            <span className="tick" />
            Ausgangsdaten
          </h3>
          <div className="stack">
            <div className="field">
              <label>Aktuelles Arbeitsgewicht</label>
              <input className="inp big" defaultValue={plan.work ?? ''} onBlur={feldGeaendert('work')} inputMode="decimal" />
              <small>kg, die du sauber bewegst</small>
            </div>
            <div className="grid g2" style={{ gap: 10 }}>
              <div className="field">
                <label>Wiederholungen</label>
                <input className="inp big" defaultValue={plan.reps ?? ''} onBlur={feldGeaendert('reps')} inputMode="numeric" />
              </div>
              <div className="field">
                <label>Wdh in Reserve</label>
                <input className="inp big" defaultValue={plan.rir ?? ''} onBlur={feldGeaendert('rir')} inputMode="numeric" />
              </div>
            </div>
            <div className="field">
              <label>Kleinste Scheibenstufe</label>
              <input className="inp big" defaultValue={plan.plate ?? ''} onBlur={feldGeaendert('plate')} inputMode="decimal" />
              <small>kg — darauf wird jede Vorgabe gerundet</small>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 13 }}>
              <div className="lab mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
                Geschätztes 1RM
              </div>
              <div
                style={{
                  fontFamily: 'var(--f-display)',
                  fontSize: 44,
                  fontWeight: 600,
                  color: bsp ? 'var(--ink-3)' : 'var(--neon)',
                  lineHeight: 1.05,
                }}
              >
                {bsp && <span style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-body)' }}>z. B. </span>}
                {e1}
                <span style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-body)' }}> kg</span>
              </div>
              <p className="muted tiny" style={{ margin: '5px 0 0' }}>
                Epley: {plan.work ?? 0} × (1 + ({plan.reps ?? 0} + {plan.rir ?? 0}) / 30)
              </p>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>
              <span className="tick" />
              Bankdrücken schwer{bsp ? <span className="chip mute" style={{ marginLeft: 6 }}>z. B.</span> : null}
            </h3>
            {progression && <ProgressionTable plan={plan} rows={benchRowsFor(progression, 'd1')} dim={bsp} />}
          </div>
          <div className="card">
            <h3>
              <span className="tick" style={{ background: 'var(--violet)' }} />
              Bankdrücken mit Pause{bsp ? <span className="chip mute" style={{ marginLeft: 6 }}>z. B.</span> : null}
            </h3>
            {progression && <ProgressionTable plan={plan} rows={benchRowsFor(progression, 'd3')} dim={bsp} />}
          </div>
        </div>
      </div>

      <RechnerCard plate={plan.plate ?? 2.5} />
    </section>
  )
}
