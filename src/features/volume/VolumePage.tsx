import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useSetsForExercises } from '../training/queries'
import { gruppeSetsByExercise } from '../training/calc'
import { useVolumeRows, useCreateVolumeRow, useUpdateVolumeRow, useDeleteVolumeRow, volumeVerdict } from './queries'
import { istSaetzeJeGruppeUndTag, istGesamt } from './calc'
import { neueId } from '../../lib/offline/keys'
import { cssVars } from '../../lib/style'
import { onKeyDownAndroidBackspaceFix } from '../../lib/nativeShell'

export function VolumePage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const exerciseIds = (days ?? []).flatMap(d => d.exercises.map(ex => ex.id))
  const { data: saetzeWoche } = useSetsForExercises(exerciseIds, activePlan?.week ?? 1, activePlan?.id ?? 'ohne-plan')
  const { data: rows } = useVolumeRows(activePlan?.id)
  const createRow = useCreateVolumeRow()
  const updateRow = useUpdateVolumeRow()
  const deleteRow = useDeleteVolumeRow()
  const [neuerName, setNeuerName] = useState('')
  // Erzwingt einen frischen Input-Knoten nach "Hinzufügen" (siehe unten) -
  // das Feld bleibt sonst dauerhaft gemountet, defaultValue würde die
  // Anzeige beim Leeren also nicht mitziehen.
  const [neuerNameKey, setNeuerNameKey] = useState(0)

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

  const setsByExercise = gruppeSetsByExercise(saetzeWoche ?? [])
  const tabelle = istSaetzeJeGruppeUndTag(days ?? [], setsByExercise)

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Kontrollblatt</span>
          <h2>Volumen</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <div className="tbl-wrap" style={{ border: 0, background: 'transparent' }}>
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
                const proTag = tabelle.get(r.muscle_group)
                const gesamt = istGesamt(proTag)
                const urteil = volumeVerdict(gesamt)
                return (
                  <tr key={r.id}>
                    <td>{r.muscle_group}</td>
                    {(days ?? []).map(d => (
                      <td key={d.id} className="num">
                        {proTag?.get(d.id) ?? 0}
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
                        onKeyDown={onKeyDownAndroidBackspaceFix}
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
        </div>

        <p className="muted tiny" style={{ marginTop: 10 }}>
          Die Zahlen kommen direkt aus abgehakten Sätzen — ordne dazu eine Übung im Training-Tab dieser Muskelgruppe zu.
        </p>

        <div className="row" style={{ marginTop: 14, gap: 8 }}>
          {/* defaultValue + key: der key erzwingt nach "Hinzufügen" einen
              frischen, leeren Input-Knoten. onKeyDown fängt einen Android-
              WebView-Bug ab (siehe onKeyDownAndroidBackspaceFix in
              lib/nativeShell.ts). */}
          <input
            key={neuerNameKey}
            className="inp"
            placeholder="Neue Muskelgruppe"
            defaultValue={neuerName}
            onChange={e => setNeuerName(e.target.value)}
            onKeyDown={onKeyDownAndroidBackspaceFix}
            style={{ maxWidth: 220 }}
          />
          <button
            className="btn sm"
            disabled={!neuerName.trim()}
            onClick={() => {
              createRow.mutate({
                id: neueId(),
                plan_id: activePlan.id,
                muscle_group: neuerName.trim(),
                sort_order: (rows ?? []).length,
              })
              setNeuerName('')
              setNeuerNameKey(k => k + 1)
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </section>
  )
}
