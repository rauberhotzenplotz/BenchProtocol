import { useState } from 'react'
import type { RpeBlock, RpePlannedSet } from '../../types/db'
import { usePlannedSets, useLogWeek, useSetBlockStatus, useDeleteBlock } from './queries'
import { blockAuswertung, empfehlung, type WochenEintrag, type BlockEmpfehlungTyp } from './blockAuswertung'
import { geschaetztes1RM } from './e1rm'
import { E1rmVerlauf } from './E1rmVerlauf'

const EMPFEHLUNG_LABEL: Record<BlockEmpfehlungTyp, string> = {
  PROGRESS: 'Fortschritt',
  ADD_STIMULUS: 'Reiz erhöhen',
  REDUCE_FATIGUE: 'Ermüdung senken',
  INSUFFICIENT_DATA: 'Noch zu wenig Daten',
}
const EMPFEHLUNG_CHIP: Record<BlockEmpfehlungTyp, string> = {
  PROGRESS: 'chip ok',
  ADD_STIMULUS: 'chip low',
  REDUCE_FATIGUE: 'chip high',
  INSUFFICIENT_DATA: 'chip mute',
}

export function BlockDetail({
  block,
  exerciseName,
  onZurueck,
}: {
  block: RpeBlock
  exerciseName: string
  onZurueck: () => void
}) {
  const { data: wochen } = usePlannedSets(block.id)
  const setStatus = useSetBlockStatus()
  const deleteBlock = useDeleteBlock()
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false)

  if (!wochen) return null

  const eintraege: WochenEintrag[] = wochen.map(w => ({
    woche: w.week_number,
    topSatz: w.actual_weight != null && w.actual_reps != null && w.actual_rpe != null ? { gewicht: w.actual_weight, wdh: w.actual_reps, rpe: w.actual_rpe } : null,
    geplanterRpe: w.target_rpe,
  }))
  const auswertung = blockAuswertung(eintraege)
  const empf = empfehlung(auswertung)

  const punkte = wochen
    .map(w => {
      if (w.actual_weight == null || w.actual_reps == null || w.actual_rpe == null) return null
      const e1 = geschaetztes1RM(w.actual_weight, w.actual_reps, w.actual_rpe)
      return e1 != null ? { woche: w.week_number, e1rm: e1 } : null
    })
    .filter((p): p is { woche: number; e1rm: number } => p != null)

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12, alignItems: 'center', gap: 10 }}>
        <button className="btn sm ghost" onClick={onZurueck} aria-label="Zurück zur Übersicht">
          ‹ Blöcke
        </button>
        <b style={{ fontFamily: 'var(--f-display)', fontSize: 16 }}>{exerciseName}</b>
        <span className={block.status === 'active' ? 'chip neon' : block.status === 'completed' ? 'chip ok' : 'chip mute'}>
          {block.status === 'active' ? 'läuft' : block.status === 'completed' ? 'abgeschlossen' : 'abgebrochen'}
        </span>
        <span className="spacer" />
        {loeschenBestaetigen ? (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setLoeschenBestaetigen(false)}>
              Abbrechen
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                deleteBlock.mutate(block.id)
                onZurueck()
              }}
            >
              Löschen
            </button>
          </div>
        ) : (
          <>
            {block.status === 'active' && (
              <button className="btn sm ghost" onClick={() => setStatus.mutate({ id: block.id, status: 'completed' })}>
                Abschließen
              </button>
            )}
            <button className="rowbtn del" title="Block löschen" onClick={() => setLoeschenBestaetigen(true)}>
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
              </svg>
            </button>
          </>
        )}
      </div>

      <E1rmVerlauf punkte={punkte} />

      <div className="stack" style={{ marginTop: 14, gap: 8 }}>
        {wochen.map(w => (
          <WochenZeile key={w.id} woche={w} />
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 14 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span className={EMPFEHLUNG_CHIP[empf.typ]}>{EMPFEHLUNG_LABEL[empf.typ]}</span>
        </div>
        <p className="muted tiny" style={{ margin: 0 }}>
          {empf.begruendung}
        </p>
      </div>
    </div>
  )
}

function WochenZeile({ woche }: { woche: RpePlannedSet }) {
  const logWeek = useLogWeek()
  const bereitsGeloggt = woche.actual_weight != null && woche.actual_reps != null && woche.actual_rpe != null

  const [gewicht, setGewicht] = useState('')
  const [wdh, setWdh] = useState(String(woche.target_reps))
  const [rpe, setRpe] = useState(String(woche.target_rpe))

  const eintragen = () => {
    const g = parseFloat(gewicht.replace(',', '.'))
    const w = parseInt(wdh, 10)
    const r = parseFloat(rpe.replace(',', '.'))
    if (!(g > 0) || !(w > 0) || !(r >= 6 && r <= 10)) return
    logWeek.mutate({ id: woche.id, blockId: woche.block_id, gewicht: g, wdh: w, rpe: r })
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8, marginBottom: bereitsGeloggt ? 0 : 8, flexWrap: 'wrap' }}>
        <b style={{ minWidth: 60 }}>Woche {woche.week_number}</b>
        <span className="chip mute">
          Ziel {woche.target_reps} Wdh. @ RPE {woche.target_rpe}
          {woche.target_weight != null ? ` · ${woche.target_weight} kg` : ''}
        </span>
        {bereitsGeloggt && (
          <span className="chip ok">
            Erreicht: {woche.actual_weight} kg × {woche.actual_reps} @ RPE {woche.actual_rpe}
          </span>
        )}
      </div>
      {!bereitsGeloggt && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="inp mono" placeholder="kg" inputMode="decimal" value={gewicht} onChange={e => setGewicht(e.target.value)} style={{ maxWidth: 90 }} />
          <input className="inp mono" placeholder="Wdh" inputMode="numeric" value={wdh} onChange={e => setWdh(e.target.value)} style={{ maxWidth: 70 }} />
          <input className="inp mono" placeholder="RPE" inputMode="decimal" value={rpe} onChange={e => setRpe(e.target.value)} style={{ maxWidth: 70 }} />
          <button className="btn sm primary" onClick={eintragen}>
            Eintragen
          </button>
        </div>
      )}
    </div>
  )
}
