import type { BenchProgressionRow, Plan } from '../../types/db'
import { useUpdateBenchProgressionRow } from './queries'
import { benchLoad } from './calc'

export function ProgressionTable({ plan, rows, dim }: { plan: Plan; rows: BenchProgressionRow[]; dim: boolean }) {
  const updateRow = useUpdateBenchProgressionRow()

  return (
    <div className="tbl-wrap" style={{ border: 0, background: 'transparent' }}>
      <table className="bench-tbl" style={{ minWidth: 340, opacity: dim ? 0.55 : 1 }}>
        <thead>
          <tr>
            <th>Woche</th>
            <th>Vorgabe</th>
            <th style={{ width: 74 }}>% 1RM</th>
            <th style={{ width: 96 }}>Gewicht</th>
            <th>Hinweis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.week === 4 ? 'deload' : ''} style={r.week === plan.week ? { background: 'rgba(53,240,208,.05)' } : undefined}>
              <td className="wk">{r.week === 4 ? 'W4 · Deload' : `Woche ${r.week}`}</td>
              <td className="mono muted">{r.scheme}</td>
              <td className="pct">
                <input
                  className="inp mono pctinp"
                  defaultValue={Math.round((r.pct ?? 0) * 100)}
                  onBlur={e => {
                    const v = parseFloat(e.target.value.replace(',', '.'))
                    if (!isNaN(v) && v > 0) updateRow.mutate({ id: r.id, pct: v / 100 })
                  }}
                />
                <span className="muted tiny"> %</span>
              </td>
              <td className="load">
                {benchLoad(plan, r)}
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}> kg</span>
              </td>
              <td className="hint">{r.hint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
