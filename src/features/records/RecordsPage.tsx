import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useAllSetsForExercises } from '../training/queries'
import { e1rm, round } from '../bench/calc'
import { cssVars } from '../../lib/style'
import type { LoggedSet } from '../../types/db'

interface Rekord {
  reps: number
  kg: number
  e1: number
  woche: number
}

/** Bester Satz je Wiederholungszahl einer Übung, nach geschätztem 1RM. */
function besteRekorde(sets: LoggedSet[], exerciseId: string): Rekord[] {
  if (!exerciseId) return []
  const je = new Map<number, Rekord>()
  sets
    .filter(s => s.exercise_id === exerciseId && s.kg && s.reps)
    .forEach(s => {
      const wert = round(e1rm(s.kg!, s.reps!), 1)
      const bisher = je.get(s.reps!)
      if (!bisher || wert > bisher.e1) je.set(s.reps!, { reps: s.reps!, kg: s.kg!, e1: wert, woche: s.week })
    })
  return [...je.values()].sort((a, b) => a.reps - b.reps)
}

export function RecordsPage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const alleExercises = (days ?? []).flatMap(d => d.exercises)
  const exerciseIds = alleExercises.map(e => e.id)
  const { data: sets } = useAllSetsForExercises(exerciseIds)

  const [gewaehlt, setGewaehlt] = useState<string>('')
  const aktivId = gewaehlt || alleExercises[0]?.id || ''
  const aktiveUebung = alleExercises.find(e => e.id === aktivId)

  // Kleine Datenmenge (Sätze einer Übung) — kein useMemo nötig, wird bei
  // jedem Render einfach neu berechnet.
  const rekorde = besteRekorde(sets ?? [], aktivId)

  const bestGesamt = rekorde.reduce<Rekord | null>((a, r) => (!a || r.e1 > a.e1 ? r : a), null)

  if (!activePlan || !alleExercises.length) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <h2>Rekorde</h2>
          <p>Noch keine Übungen mit geloggten Sätzen vorhanden.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Bestleistung je Wiederholungszahl</span>
          <h2>Rekorde</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <div className="row" style={{ marginBottom: 14, gap: 12 }}>
          <select className="inp" value={aktivId} onChange={e => setGewaehlt(e.target.value)} style={{ maxWidth: 320 }}>
            {alleExercises.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          {bestGesamt && (
            <span className="chip mute">
              Bestes e1RM {bestGesamt.e1} kg ({bestGesamt.kg} kg × {bestGesamt.reps})
            </span>
          )}
        </div>

        {rekorde.length === 0 ? (
          <p className="muted tiny" style={{ padding: '22px 0', textAlign: 'center', margin: 0 }}>
            Für „{aktiveUebung?.name}“ ist noch nichts geloggt.
          </p>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th>Wdh.</th>
                <th>Gewicht</th>
                <th>e1RM</th>
                <th>Woche</th>
              </tr>
            </thead>
            <tbody>
              {rekorde.map(r => (
                <tr key={r.reps}>
                  <td>{r.reps}</td>
                  <td className="num">{r.kg} kg</td>
                  <td className="num">{r.e1} kg</td>
                  <td className="num">{r.woche}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
