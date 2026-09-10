import { Fragment } from 'react'
import { formatGewicht } from '../../lib/zahlen'
import type { BenchProgressionRow, Plan } from '../../types/db'
import { useUpdateBenchProgressionRow } from './queries'
import { benchLoad } from './calc'
import { blockWoche } from '../training/calc'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'

export function ProgressionTable({ plan, rows, dim }: { plan: Plan; rows: BenchProgressionRow[]; dim: boolean }) {
  const updateRow = useUpdateBenchProgressionRow()

  return (
    <div className="tbl-wrap" style={{ border: 0, background: 'transparent' }}>
      <table className="bench-tbl" style={{ opacity: dim ? 0.55 : 1 }}>
        <thead>
          <tr>
            <th>Woche</th>
            <th>Vorgabe</th>
            <th style={{ width: 58 }}>% 1RM</th>
            <th style={{ width: 86 }}>Gewicht</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            /* Der Hinweis steht in einer eigenen Zeile unter den Zahlen.
               Als fuenfte Spalte machte er die Tabelle 433 px breit -- in
               einer 309 px breiten Karte, deren Scrollbalken global
               ausgeblendet ist. Ausgerechnet die Kilo-Vorgabe, die
               wichtigste Zahl der Seite, lag damit ausserhalb des Bildes. */
            <Fragment key={r.id}>
            <tr className={r.week === 4 ? 'deload' : ''} style={r.week === blockWoche(plan.week) ? { background: 'rgba(var(--akzent-rgb),.05)' } : undefined}>
              <td className="wk">{r.week === 4 ? 'W4 · Deload' : `Woche ${r.week}`}</td>
              <td className="mono muted">{r.scheme}</td>
              <td className="pct">
                {/* onKeyDown fängt einen Android-WebView-Bug ab (siehe
                    onKeyDownAndroidBackspaceFix in lib/nativeShell.ts). */}
                <input
                  className="inp mono pctinp"
                  defaultValue={Math.round((r.pct ?? 0) * 100)}
                  onKeyDown={onKeyDownAndroidBackspaceFix}
                  onBlur={e => {
                    const v = parseFloat(e.target.value.replace(',', '.'))
                    if (!isNaN(v) && v > 0) updateRow.mutate({ id: r.id, pct: v / 100 })
                  }}
                />
              </td>
              <td className="load">
                {formatGewicht(benchLoad(plan, r))}
                <span style={{ fontSize: 14, color: 'var(--ink-3)' }}> kg</span>
              </td>
            </tr>
            {r.hint && (
              <tr className="hinweiszeile" style={r.week === blockWoche(plan.week) ? { background: 'rgba(var(--akzent-rgb),.05)' } : undefined}>
                <td colSpan={4}>{r.hint}</td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
