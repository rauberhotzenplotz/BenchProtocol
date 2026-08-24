import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSchliessenPerZurueck } from '../../lib/backClose'

interface Props {
  titel: string
  /** Die eine Zahl, die die Kachel in der Übersicht trägt. */
  wert: ReactNode
  einheit?: string
  hinweis?: string
  /** Die vollständige Grafik. Fehlt sie (zu wenig Daten), bleibt die
      Kachel eine reine Anzeige und lässt sich nicht antippen. */
  children?: ReactNode
}

/** Kompakte Kachel für die Cockpit-Übersicht: Titel, eine Zahl, ein
    kurzer Hinweis. Erst beim Antippen erscheint die vollständige Grafik im
    Vollbild — die Übersicht bleibt dadurch kurz und scrollarm, ohne dass
    Auswertungen verloren gehen. */
export function KachelKarte({ titel, wert, einheit, hinweis, children }: Props) {
  const [offen, setOffen] = useState(false)

  useSchliessenPerZurueck(offen, () => setOffen(false))

  useEffect(() => {
    if (!offen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [offen])

  const inhalt = (
    <>
      <span className="kachel-tit">{titel}</span>
      <span className="kachel-wert">
        <span className="zahlglow">{wert}</span>
        {einheit && <u>{einheit}</u>}
      </span>
      {hinweis && <span className="kachel-hin">{hinweis}</span>}
    </>
  )

  if (!children) return <div className="kachel leer">{inhalt}</div>

  return (
    <>
      <button className="kachel" onClick={() => setOffen(true)} aria-haspopup="dialog" aria-label={`${titel} — Grafik öffnen`}>
        {inhalt}
        <svg className="kachel-pfeil" viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {offen &&
        // Portal wie beim Gym-Modus: die umgebende <section class="view
        // frisch"> trägt eine Eintrittsanimation mit transform, und ein
        // animiertes Elternelement wird für position:fixed-Nachfahren zum
        // Containing Block — ohne Portal säße das Vollbild in der Section
        // fest statt den Bildschirm zu füllen.
        createPortal(
          <div className="dfenster" role="dialog" aria-modal="true" aria-label={titel}>
            <div className="df-kopf">
              <b>{titel}</b>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => setOffen(false)}>
                Schließen
              </button>
            </div>
            <div className="df-koerper">{children}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
