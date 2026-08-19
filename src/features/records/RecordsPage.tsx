import { useState } from 'react'
import { useAlleUebungenJemals, useAllSetsForExercises } from '../training/queries'
import { gruppiere, besteRekorde, type Rekord } from './calc'
import { cssVars } from '../../lib/style'

export function RecordsPage() {
  // Bewusst planübergreifend (nicht useDays(activePlan?.id)): dieselbe
  // Katalog-Übung soll ihre Bestenliste behalten, auch wenn sie in einem
  // anderen Plan weitertrainiert wird — siehe gruppiere() in calc.ts.
  const { data: alleUebungen } = useAlleUebungenJemals()
  const gruppen = gruppiere(alleUebungen ?? [])
  const exerciseIds = (alleUebungen ?? []).map(e => e.id)
  const { data: sets } = useAllSetsForExercises(exerciseIds)

  const [gewaehlt, setGewaehlt] = useState<string>('')
  const aktivKey = gewaehlt || gruppen[0]?.key || ''
  const aktiveGruppe = gruppen.find(g => g.key === aktivKey)

  // Kleine Datenmenge — kein useMemo nötig, wird bei jedem Render einfach
  // neu berechnet.
  const rekorde = besteRekorde(sets ?? [], aktiveGruppe?.exerciseIds ?? [])

  const bestGesamt = rekorde.reduce<Rekord | null>((a, r) => (!a || r.e1 > a.e1 ? r : a), null)

  if (!gruppen.length) {
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
          <select className="inp" value={aktivKey} onChange={e => setGewaehlt(e.target.value)} style={{ maxWidth: 320 }}>
            {gruppen.map(g => (
              <option key={g.key} value={g.key}>
                {g.name}
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
            Für „{aktiveGruppe?.name}“ ist noch nichts geloggt.
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
