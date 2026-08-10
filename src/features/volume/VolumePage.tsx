import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays } from '../training/queries'
import { useVolumeRows, useCreateVolumeRow, useUpdateVolumeRow, useDeleteVolumeRow, totalSetsOf, volumeVerdict } from './queries'
import { cssVars } from '../../lib/style'

export function VolumePage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const { data: rows } = useVolumeRows(activePlan?.id)
  const createRow = useCreateVolumeRow(activePlan?.id)
  const updateRow = useUpdateVolumeRow(activePlan?.id)
  const deleteRow = useDeleteVolumeRow(activePlan?.id)
  const [neuerName, setNeuerName] = useState('')

  if (!activePlan) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <h2>Volumen</h2>
          <p>Noch kein Plan vorhanden.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Kontrollblatt</span>
          <h2>Volumen</h2>
          <p>Arbeitssätze je Muskelgruppe und Trainingstag — Zielband 8–20 Sätze pro Woche.</p>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <table className="t">
          <thead>
            <tr>
              <th>Muskelgruppe</th>
              {(days ?? []).map(d => (
                <th key={d.id} style={{ width: 64 }}>
                  {d.name}
                </th>
              ))}
              <th style={{ width: 64 }}>Summe</th>
              <th>Notiz</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map(r => {
              const gesamt = totalSetsOf(r)
              const urteil = volumeVerdict(gesamt)
              return (
                <tr key={r.id}>
                  <td>{r.muscle_group}</td>
                  {(days ?? []).map(d => (
                    <td key={d.id} className="num">
                      <input
                        className="inp mono"
                        style={{ width: 48, textAlign: 'center' }}
                        defaultValue={r.sets_by_day[d.id] ?? 0}
                        inputMode="numeric"
                        onBlur={e => {
                          const v = parseInt(e.target.value, 10)
                          updateRow.mutate({ id: r.id, patch: { sets_by_day: { ...r.sets_by_day, [d.id]: isNaN(v) ? 0 : v } } })
                        }}
                      />
                    </td>
                  ))}
                  <td className="num">
                    <span className={`chip ${urteil.klasse}`} title={urteil.text}>
                      {gesamt}
                    </span>
                  </td>
                  <td>
                    <input
                      className="inp voll dim"
                      defaultValue={r.note ?? ''}
                      onBlur={e => updateRow.mutate({ id: r.id, patch: { note: e.target.value } })}
                    />
                  </td>
                  <td>
                    <button className="rowbtn del" title="Zeile löschen" onClick={() => deleteRow.mutate(r.id)}>
                      <svg viewBox="0 0 24 24">
                        <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 14, gap: 8 }}>
          <input
            className="inp"
            placeholder="Neue Muskelgruppe"
            value={neuerName}
            onChange={e => setNeuerName(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <button
            className="btn sm"
            disabled={!neuerName.trim()}
            onClick={() => {
              createRow.mutate({ muscleGroup: neuerName.trim(), sortOrder: (rows ?? []).length })
              setNeuerName('')
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </section>
  )
}
