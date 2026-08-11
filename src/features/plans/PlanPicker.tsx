import { useState } from 'react'
import { useActivePlan } from './active-plan-context'
import { useCreatePlan, useDeletePlan, useUpdatePlan } from './queries'
import type { PlanTyp } from '../../types/db'

/** Knopf mit dem Namen des aktiven Plans, öffnet die Verwaltung — Pendant
    zu #planBtn / planVerwaltung() aus der alten App. */
export function PlanPicker() {
  const [offen, setOffen] = useState(false)
  const { activePlan } = useActivePlan()

  return (
    <>
      <button className="planpill" onClick={() => setOffen(true)} title="Plan wechseln oder verwalten">
        <svg viewBox="0 0 24 24">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5V20.5" />
        </svg>
        <span>{activePlan ? activePlan.name : 'Kein Plan'}</span>
        <svg className="chev" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {offen && <PlanManagerDialog onClose={() => setOffen(false)} />}
    </>
  )
}

function PlanManagerDialog({ onClose }: { onClose: () => void }) {
  const { plans, activePlan, setActivePlanId } = useActivePlan()
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()
  const deletePlan = useDeletePlan()

  const [neuerTyp, setNeuerTyp] = useState<PlanTyp | null>(null)
  const [name, setName] = useState('')
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null)
  const [umbenennenName, setUmbenennenName] = useState('')
  const [loeschenId, setLoeschenId] = useState<string | null>(null)

  const anlegen = async () => {
    const trimmed = name.trim()
    if (!trimmed || !neuerTyp) return
    const plan = await createPlan.mutateAsync({ name: trimmed, typ: neuerTyp })
    setActivePlanId(plan.id)
    setName('')
    setNeuerTyp(null)
  }

  const umbenennen = async (id: string) => {
    const trimmed = umbenennenName.trim()
    if (trimmed) await updatePlan.mutateAsync({ id, patch: { name: trimmed } })
    setUmbenennenId(null)
  }

  const loeschen = async (id: string) => {
    if (plans.length <= 1) return
    await deletePlan.mutateAsync(id)
    setLoeschenId(null)
    if (activePlan?.id === id) {
      const rest = plans.find(p => p.id !== id)
      if (rest) setActivePlanId(rest.id)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="planTitel">
        <h4 id="planTitel">Trainingspläne</h4>
        <p>Wähle einen Plan oder leg einen neuen an. Gewichte und Verlauf bleiben bei den Übungen, auch wenn du wechselst.</p>

        <div className="planliste">
          {plans.map(p => (
            <div key={p.id} className={'planzeile' + (p.id === activePlan?.id ? ' aktiv' : '')}>
              {loeschenId === p.id ? (
                <div className="row" style={{ flex: 1, gap: 8, alignItems: 'center' }}>
                  <span className="txt" style={{ flex: 1 }}>
                    <b>„{p.name}“ wirklich löschen?</b>
                    <small>Alle Tage, Übungen und geloggten Sätze gehen verloren.</small>
                  </span>
                  <button className="btn ghost sm" onClick={() => setLoeschenId(null)}>
                    Abbrechen
                  </button>
                  <button className="btn sm danger" onClick={() => void loeschen(p.id)}>
                    Löschen
                  </button>
                </div>
              ) : umbenennenId === p.id ? (
                <input
                  className="inp"
                  autoFocus
                  value={umbenennenName}
                  onChange={e => setUmbenennenName(e.target.value)}
                  onBlur={() => void umbenennen(p.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void umbenennen(p.id)
                    if (e.key === 'Escape') setUmbenennenId(null)
                  }}
                />
              ) : (
                <button
                  className="plan-waehlen"
                  onClick={() => {
                    setActivePlanId(p.id)
                    onClose()
                  }}
                >
                  <span className="punkt" />
                  <span className="txt">
                    <b>{p.name}</b>
                    <small>{p.typ === 'bench' ? 'Bankfokus' : 'Standard'}</small>
                  </span>
                </button>
              )}
              {loeschenId !== p.id && (
                <>
                  <button
                    className="rowbtn"
                    title="Umbenennen"
                    aria-label={`${p.name} umbenennen`}
                    onClick={() => {
                      setUmbenennenId(p.id)
                      setUmbenennenName(p.name)
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    className="rowbtn del"
                    title="Löschen"
                    aria-label={`${p.name} löschen`}
                    disabled={plans.length <= 1}
                    onClick={() => setLoeschenId(p.id)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {!neuerTyp ? (
          <div className="planneu">
            <p className="mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', margin: '9px 0' }}>
              Neuer Plan — welche Art?
            </p>
            <button className="opt" onClick={() => setNeuerTyp('bench')}>
              <span>
                <b>Plan mit Bankfokus</b>
                <small>Eigener Fortschrittsblock, Ziel-Fortschritt, Rekorde und das ausführliche Cockpit</small>
              </span>
            </button>
            <button className="opt" style={{ marginBottom: 0 }} onClick={() => setNeuerTyp('general')}>
              <span>
                <b>Standardplan</b>
                <small>Freie Tage und Übungen, schlankes Cockpit ohne Bankdrücken-Steuerung</small>
              </span>
            </button>
          </div>
        ) : (
          <div className="planneu">
            <p className="mono tiny" style={{ color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', margin: '9px 0' }}>
              Neuer {neuerTyp === 'bench' ? 'Plan mit Bankfokus' : 'Standardplan'}{' '}
              <button className="linkbtn" onClick={() => setNeuerTyp(null)}>
                andere Art wählen
              </button>
            </p>
            <div className="row">
              <input
                className="inp"
                placeholder="Name für den Plan"
                maxLength={40}
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void anlegen()}
              />
              <button className="btn sm primary" onClick={() => void anlegen()}>
                Anlegen
              </button>
            </div>
          </div>
        )}

        <div className="row end" style={{ marginTop: 14 }}>
          <button className="btn ghost sm" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
