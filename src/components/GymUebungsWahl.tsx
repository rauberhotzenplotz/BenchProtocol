import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface UebwahlEintrag {
  id: string
  name: string
  erledigt: number
  soll: number
}

interface Props {
  offen: boolean
  uebungen: UebwahlEintrag[]
  aktiverIndex: number
  onWahl: (index: number) => void
  onSchliessen: () => void
}

/** Übungswechsel außer der Reihe: manchmal ist eine Bank belegt oder ein
    Gerät gerade frei — dann soll man nicht stur der Planreihenfolge
    ausgeliefert sein. Teilt sich die Bottom-Sheet-Hülle mit dem ZahlRad
    (Griff, Nebel-Kopf, Schließen-Knopf), damit beide Sheets im Gym-Modus
    wie derselbe Baustein wirken — nur die Liste selbst ist eine eigene,
    da Übungen (Name + Fortschritt) mehr Platz brauchen als eine Zahl. */
export function GymUebungsWahl({ offen, uebungen, aktiverIndex, onWahl, onSchliessen }: Props) {
  useEffect(() => {
    if (!offen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [offen, onSchliessen])

  if (!offen) return null

  return createPortal(
    <div className="zahlrad-overlay" onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div className="zahlrad" role="dialog" aria-modal="true" aria-label="Übung wählen">
        <span className="zahlrad-griff" aria-hidden="true" />
        <div className="zahlrad-kopf">
          <span>Übung wählen</span>
          <button type="button" className="zahlrad-schliessen" onClick={onSchliessen} aria-label="Schließen">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="uebwahl-liste">
          {uebungen.map((u, i) => {
            const fertig = u.soll > 0 && u.erledigt >= u.soll
            return (
              <button
                key={u.id}
                type="button"
                className={'uebwahl-zeile' + (i === aktiverIndex ? ' an' : '') + (fertig ? ' fertig' : '')}
                onClick={() => {
                  onWahl(i)
                  onSchliessen()
                }}
              >
                <span className="uebwahl-nr">{fertig ? '✓' : i + 1}</span>
                <span className="uebwahl-name">{u.name}</span>
                <span className="uebwahl-status">{u.soll > 0 ? `${u.erledigt}/${u.soll}` : '—'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
