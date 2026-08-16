import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ZahlRadProps {
  offen: boolean
  titel: string
  werte: number[]
  aktuell: number | null
  format: (n: number) => string
  /** Erste Zeile "—" zum Leeren des Werts — für Felder, die auch unausgefüllt sein dürfen. */
  leerOption?: boolean
  onWahl: (n: number | null) => void
  onSchliessen: () => void
}

/** Tastatureingabe für Zahlen ersetzt durch eine antippbare Liste: kein
    Zahlenfeld, in das man sich vertippen kann — jeder Wert ist ein eigener
    Tastendruck. Als Bottom-Sheet mit eigenem Scrollbereich, damit auch
    lange Listen (z. B. Gewicht in 2,5-kg-Schritten bis 300 kg) bequem
    erreichbar bleiben. */
export function ZahlRad({ offen, titel, werte, aktuell, format, leerOption, onWahl, onSchliessen }: ZahlRadProps) {
  const listeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [offen, onSchliessen])

  useEffect(() => {
    if (!offen) return
    const liste = listeRef.current
    if (!liste) return
    const aktiv = liste.querySelector<HTMLElement>('[data-an="true"]')
    aktiv?.scrollIntoView({ block: 'center' })
  }, [offen])

  if (!offen) return null

  return createPortal(
    <div className="zahlrad-overlay" onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div className="zahlrad" role="dialog" aria-modal="true" aria-label={titel}>
        <span className="zahlrad-griff" aria-hidden="true" />
        <div className="zahlrad-kopf">
          <span>{titel}</span>
          <button type="button" className="zahlrad-schliessen" onClick={onSchliessen} aria-label="Schließen">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="zahlrad-liste" ref={listeRef}>
          {leerOption && (
            <button
              type="button"
              className={'zahlrad-wert' + (aktuell == null ? ' an' : '')}
              data-an={aktuell == null}
              onClick={() => {
                onWahl(null)
                onSchliessen()
              }}
            >
              —
            </button>
          )}
          {werte.map(w => (
            <button
              key={w}
              type="button"
              className={'zahlrad-wert' + (w === aktuell ? ' an' : '')}
              data-an={w === aktuell}
              onClick={() => {
                onWahl(w)
                onSchliessen()
              }}
            >
              {format(w)}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface ZahlEingabeProps {
  wert: number | null
  werte: number[]
  format?: (n: number) => string
  titel: string
  leerOption?: boolean
  platzhalter?: string
  className?: string
  onWahl: (n: number | null) => void
}

/** Antippbarer Auslöser fürs ZahlRad — Drop-in-Ersatz für ein Zahlenfeld
    (gleiche ".inp"-Optik), öffnet beim Antippen die Auswahlliste statt
    die Tastatur. */
export function ZahlEingabe({ wert, werte, format = String, titel, leerOption, platzhalter = '—', className, onWahl }: ZahlEingabeProps) {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={'inp zahleingabe' + (className ? ' ' + className : '')}
        onClick={() => setOffen(true)}
      >
        {wert != null ? format(wert) : platzhalter}
      </button>
      <ZahlRad
        offen={offen}
        titel={titel}
        werte={werte}
        aktuell={wert}
        format={format}
        leerOption={leerOption}
        onWahl={onWahl}
        onSchliessen={() => setOffen(false)}
      />
    </>
  )
}
