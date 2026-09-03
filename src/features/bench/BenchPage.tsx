import { useActivePlan } from '../plans/active-plan-context'
import { useBenchProgression, benchRowsFor } from './queries'
import { baseE1RM, benchLoad } from './calc'
import { ProgressionTable } from './ProgressionTable'
import { AusgangsdatenCard } from './AusgangsdatenCard'
import { GoalCard } from './GoalCard'
import { RechnerCard } from './RechnerCard'
import { LastVerteilung } from './LastVerteilung'
import { CountUp } from '../../components/CountUp'
import { wochenLabel, blockWoche } from '../training/calc'
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
  const { data: progression } = useBenchProgression(plan.id)

  const bsp = !plan.beruehrt
  const e1 = baseE1RM(plan)
  const rowsD1 = progression ? benchRowsFor(progression, 'd1') : []
  const heuteD1 = rowsD1.find(r => r.week === blockWoche(plan.week))
  const zielD1 = heuteD1 ? benchLoad(plan, heuteD1) : 0

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">
            Block {plan.block ?? 1} · {wochenLabel(plan.week, plan)}
          </span>
          <h2>Bankdrücken</h2>
        </div>
      </div>

      {plan.last_delta_note && (
        <div className="note" style={cssVars({ '--i': 1 })}>
          <strong>Letzter automatischer Blockwechsel:</strong> {plan.last_delta_note}
        </div>
      )}

      <AusgangsdatenCard plan={plan} />

      <GoalCard plan={plan} />

      <div className="grid g-12" style={{ ...cssVars({ '--i': 2 }), marginBottom: 14 }}>
        <div className="card">
          <h3>
            <span className="tick" />
            Heute auf der Bank
          </h3>
          <div className="stack">
            <div>
              <div className="lab mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
                Bankdrücken schwer
              </div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 44, fontWeight: 600, color: bsp ? 'var(--ink-3)' : 'var(--violet)', lineHeight: 1.05 }}>
                <CountUp value={zielD1} decimals={1} />
                <span style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-body)' }}> kg</span>
              </div>
              <p className="muted tiny" style={{ margin: '5px 0 0' }}>{heuteD1?.scheme ?? '—'}</p>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 13 }}>
              <div className="lab mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
                Geschätztes 1RM
              </div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontWeight: 600, color: bsp ? 'var(--ink-3)' : 'var(--neon)', lineHeight: 1.05 }}>
                {e1}
                <span style={{ fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--f-body)' }}> kg</span>
              </div>
              <p className="muted tiny" style={{ margin: '5px 0 0' }}>
                {plan.rpe != null
                  ? `RPE-Tabelle: ${plan.work ?? 0} kg × ${plan.reps ?? 0} Wdh. @ RPE ${plan.rpe}`
                  : `Epley: ${plan.work ?? 0} × (1 + (${plan.reps ?? 0} + ${plan.rir ?? 0}) / 30)`}
              </p>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>
              <span className="tick" />
              Bankdrücken schwer
            </h3>
            {progression && <ProgressionTable plan={plan} rows={benchRowsFor(progression, 'd1')} dim={bsp} />}
          </div>
          <div className="card">
            <h3>
              <span className="tick" style={{ background: 'var(--violet)' }} />
              Bankdrücken mit Pause
            </h3>
            {progression && <ProgressionTable plan={plan} rows={benchRowsFor(progression, 'd3')} dim={bsp} />}
          </div>
        </div>
      </div>

      {progression && (
        <div style={{ marginBottom: 14 }}>
          <LastVerteilung
            plan={plan}
            zeilen={{ d1: benchRowsFor(progression, 'd1'), d3: benchRowsFor(progression, 'd3') }}
          />
        </div>
      )}

      <RechnerCard planId={plan.id} plate={plan.plate ?? 2.5} />
    </section>
  )
}
