import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays } from '../training/queries'
import { useBlocksForExercises } from './queries'
import { BlockDetail } from './BlockDetail'
import { NeuerBlockForm } from './NeuerBlockForm'
import { cssVars } from '../../lib/style'

export function RpeBlockPage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const alleExercises = (days ?? []).flatMap(d => d.exercises)
  const exerciseIds = alleExercises.map(e => e.id)

  const [gewaehlt, setGewaehlt] = useState('')
  const aktivId = gewaehlt || alleExercises[0]?.id || ''
  const aktiveUebung = alleExercises.find(e => e.id === aktivId)

  const { data: blocks } = useBlocksForExercises(exerciseIds)
  const blocksDieserUebung = (blocks ?? []).filter(b => b.exercise_id === aktivId)

  const [offenerBlock, setOffenerBlock] = useState<string | null>(null)
  const [neuerBlockOffen, setNeuerBlockOffen] = useState(false)

  if (!activePlan || !alleExercises.length) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <div>
            <span className="eyebrow">RPE-basierte Blockprogression</span>
            <h2>Blöcke</h2>
            <p>Noch keine Übungen mit einem Plan vorhanden.</p>
          </div>
        </div>
      </section>
    )
  }

  const blockDaten = offenerBlock ? blocksDieserUebung.find(b => b.id === offenerBlock) : undefined

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">RPE-basierte Blockprogression</span>
          <h2>Blöcke</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <select
          className="inp"
          value={aktivId}
          onChange={e => {
            setGewaehlt(e.target.value)
            setOffenerBlock(null)
            setNeuerBlockOffen(false)
          }}
          style={{ maxWidth: 320 }}
        >
          {alleExercises.map(ex => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {blockDaten && aktiveUebung ? (
        <div style={{ marginTop: 14 }}>
          <BlockDetail block={blockDaten} exerciseName={aktiveUebung.name} onZurueck={() => setOffenerBlock(null)} />
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {blocksDieserUebung.length === 0 && !neuerBlockOffen && (
            <p className="muted tiny" style={{ margin: '0 0 12px' }}>
              Noch kein Block für {aktiveUebung?.name ?? 'diese Übung'}.
            </p>
          )}

          <div className="stack" style={{ gap: 10, marginBottom: 14 }}>
            {blocksDieserUebung.map(b => (
              <button key={b.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOffenerBlock(b.id)}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <b>Block seit {new Date(b.start_date).toLocaleDateString('de-DE')}</b>
                  <span className={b.status === 'active' ? 'chip neon' : b.status === 'completed' ? 'chip ok' : 'chip mute'}>
                    {b.status === 'active' ? 'läuft' : b.status === 'completed' ? 'abgeschlossen' : 'abgebrochen'}
                  </span>
                  <span className="chip mute">{b.planned_weeks} Wochen</span>
                </div>
              </button>
            ))}
          </div>

          {neuerBlockOffen ? (
            <NeuerBlockForm exerciseId={aktivId} vorherigeBlocks={blocksDieserUebung} onFertig={() => setNeuerBlockOffen(false)} />
          ) : (
            <button className="btn primary sm" onClick={() => setNeuerBlockOffen(true)}>
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Neuen Block starten
            </button>
          )}
        </div>
      )}
    </section>
  )
}
