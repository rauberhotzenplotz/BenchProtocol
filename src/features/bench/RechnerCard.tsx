import { useState } from 'react'
import { e1rm, brzycki, round, mround } from './calc'

const STUFEN = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]

export function RechnerCard({ plate }: { plate: number }) {
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
          <input className="inp big" value={kg} onChange={e => setKg(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field">
          <label>Wiederholungen</label>
          <input className="inp big" value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" />
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
