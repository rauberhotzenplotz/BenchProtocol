import { useState } from 'react'
import { e1rm, brzycki, round, mround } from './calc'
import { useUpdatePlan } from '../plans/queries'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'

const STUFEN = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]

/** Die Scheibenstufe braucht irgendwo ein Zuhause, seit "Ausgangsdaten"
    entfallen ist — sie hat mit der RPE-Automatik nichts zu tun, sondern
    ist eine reine Ausstattungsfrage des Gyms. Hier passt sie thematisch:
    genau diese Zahl rundet auch die Prozent-Tabelle unten. */
export function RechnerCard({ planId, plate }: { planId: string; plate: number }) {
  const updatePlan = useUpdatePlan()
  const [kg, setKg] = useState('100')
  const [reps, setReps] = useState('5')

  const kgN = parseFloat(kg.replace(',', '.')) || 0
  const repsN = parseInt(reps, 10) || 0
  const epley = kgN && repsN ? round(e1rm(kgN, repsN), 1) : 0
  const brz = kgN && repsN ? round(brzycki(kgN, repsN), 1) : 0

  return (
    <div className="card">
      <h3>
        <span className="tick" />
        1RM-Rechner
      </h3>
      <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
        <div className="field">
          <label>Gewicht</label>
          {/* onKeyDown fängt einen Android-WebView-Bug ab (siehe
              onKeyDownAndroidBackspaceFix in lib/nativeShell.ts). */}
          <input className="inp big" defaultValue={kg} onChange={e => setKg(e.target.value)} onKeyDown={onKeyDownAndroidBackspaceFix} inputMode="decimal" />
        </div>
        <div className="field">
          <label>Wiederholungen</label>
          <input className="inp big" defaultValue={reps} onChange={e => setReps(e.target.value)} onKeyDown={onKeyDownAndroidBackspaceFix} inputMode="numeric" />
        </div>
      </div>
      <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
        <div>
          <div className="lab mono tiny" style={{ color: 'var(--ink-3)' }}>
            EPLEY
          </div>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, color: 'var(--neon)' }}>{epley} kg</div>
        </div>
        <div>
          <div className="lab mono tiny" style={{ color: 'var(--ink-3)' }}>
            BRZYCKI
          </div>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, color: 'var(--violet)' }}>{brz} kg</div>
        </div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'baseline' }}>
        <span className="muted tiny">Scheibenstufe, auf die gerundet wird</span>
        <input
          className="inp mono"
          style={{ width: 64 }}
          defaultValue={plate}
          inputMode="decimal"
          onKeyDown={onKeyDownAndroidBackspaceFix}
          onBlur={e => {
            const v = parseFloat(e.target.value.replace(',', '.'))
            if (!isNaN(v) && v > 0) updatePlan.mutate({ id: planId, patch: { plate: v } })
          }}
        />
        <span className="muted tiny">kg</span>
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>Anteil</th>
            <th>Gewicht</th>
          </tr>
        </thead>
        <tbody>
          {STUFEN.map(p => (
            <tr key={p}>
              <td>{p} %</td>
              <td className="num">{epley ? mround((epley * p) / 100, plate) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
