import { useState } from 'react'
import type { RpeBlock } from '../../types/db'
import { useCreateBlock, usePlannedSets } from './queries'
import { planeWochen } from './blockPlanung'
import { blockAuswertung, type WochenEintrag } from './blockAuswertung'
import { neueId } from '../../lib/offline/keys'

/** Schätzt das Start-1RM für einen neuen Block aus dem besten e1RM des
    letzten Blocks derselben Übung — null, wenn es noch keinen gibt oder
    der letzte Block noch keine auswertbare Woche hatte (dann startet man
    eben ohne Zielgewichte, die tatsächliche Leistung lässt sich trotzdem
    eintragen). */
function useVorschlagE1rm(letzterBlock: RpeBlock | undefined) {
  const { data: wochen } = usePlannedSets(letzterBlock?.id)
  if (!wochen) return null
  const eintraege: WochenEintrag[] = wochen.map(w => ({
    woche: w.week_number,
    topSatz: w.actual_weight != null && w.actual_reps != null && w.actual_rpe != null ? { gewicht: w.actual_weight, wdh: w.actual_reps, rpe: w.actual_rpe } : null,
    geplanterRpe: w.target_rpe,
  }))
  return blockAuswertung(eintraege).blockBestE1RM
}

export function NeuerBlockForm({ exerciseId, vorherigeBlocks, onFertig }: { exerciseId: string; vorherigeBlocks: RpeBlock[]; onFertig: () => void }) {
  const letzterBlock = vorherigeBlocks[0]
  const vorschlagE1rm = useVorschlagE1rm(letzterBlock)
  const createBlock = useCreateBlock()

  const [plannedWeeks, setPlannedWeeks] = useState(4)
  const [targetReps, setTargetReps] = useState(5)
  const [startRpe, setStartRpe] = useState(7)
  const [rpeSchritt, setRpeSchritt] = useState(0.5)
  const [plate, setPlate] = useState(letzterBlock?.plate ?? 2.5)
  const [startE1rmText, setStartE1rmText] = useState('')

  const anlegen = () => {
    const startE1rm = startE1rmText.trim() ? parseFloat(startE1rmText.replace(',', '.')) : (vorschlagE1rm ?? null)
    const wochen = planeWochen({ plannedWeeks, targetReps, startRpe, rpeSchritt, plate, startE1rm })
    // Ohne Warten auf den Server schließen: die ID entsteht hier, offline
    // wandert die Mutation in die Warteschlange.
    createBlock.mutate({ id: neueId(), exerciseId, plannedWeeks, plate, wochen })
    onFertig()
  }

  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Neuer Block
      </h3>
      <div className="stack">
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field">
            <label>Wochen</label>
            <input className="inp" type="number" min={1} value={plannedWeeks} onChange={e => setPlannedWeeks(Math.max(1, +e.target.value || 1))} />
          </div>
          <div className="field">
            <label>Zielwiederholungen</label>
            <input className="inp" type="number" min={1} max={8} value={targetReps} onChange={e => setTargetReps(Math.max(1, Math.min(8, +e.target.value || 1)))} />
          </div>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field">
            <label>Start-RPE</label>
            <input className="inp" type="number" step={0.5} min={6} max={10} value={startRpe} onChange={e => setStartRpe(+e.target.value || 6)} />
          </div>
          <div className="field">
            <label>RPE-Schritt je Woche</label>
            <input className="inp" type="number" step={0.5} value={rpeSchritt} onChange={e => setRpeSchritt(+e.target.value || 0)} />
          </div>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="field">
            <label>Hantelinkrement</label>
            <input className="inp" type="number" step={0.5} min={0.5} value={plate} onChange={e => setPlate(+e.target.value || 2.5)} />
            <small>kg — Zielgewichte werden darauf abgerundet</small>
          </div>
          <div className="field">
            <label>Start-1RM (geschätzt)</label>
            <input
              className="inp mono"
              placeholder={vorschlagE1rm != null ? `z. B. ${vorschlagE1rm.toFixed(1)}` : 'optional'}
              inputMode="decimal"
              value={startE1rmText}
              onChange={e => setStartE1rmText(e.target.value)}
            />
            <small>
              {vorschlagE1rm != null
                ? `Vorschlag aus dem letzten Block: ${vorschlagE1rm.toFixed(1)} kg — leer lassen, um ihn zu übernehmen.`
                : 'Ohne Angabe bleiben die Zielgewichte leer — du kannst trotzdem jede Woche eintragen.'}
            </small>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={onFertig}>
            Abbrechen
          </button>
          <button className="btn primary sm" disabled={createBlock.isPending} onClick={anlegen}>
            Block anlegen
          </button>
        </div>
      </div>
    </div>
  )
}
