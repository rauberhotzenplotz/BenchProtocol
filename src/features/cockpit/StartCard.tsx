import type { DayWithExercises } from '../training/queries'
import type { StartInfo } from './calc'

interface Props {
  tag: DayWithExercises | null
  info: StartInfo | null
  /** Fehlt der Rückruf (kein Plan, kein Tag), bleibt die Karte eine reine
      Anzeige statt eines Knopfes, der ins Leere führt. */
  onStart?: () => void
}

/** Die Einstiegskarte des Cockpits: was als Nächstes ansteht, woraus die
    Einheit besteht und wie lange sie üblicherweise dauert — mit der ganzen
    Karte als Startfläche.

    Bewusst kein Kennzahlen-Kästchen wie die Werte darunter: das hier ist die
    einzige Handlung der Seite, alles andere ist Rückschau. Sie bekommt
    deshalb als Einzige die volle Breite und den Akzentrand.

    Der Inhalt steckt in <span>s, nicht in <div>s: die Karte ist ein echter
    <button> (bringt Tastaturbedienung und Fokus von sich aus mit), und der
    darf nur Phrasing-Content enthalten. Die Blockdarstellung übernimmt CSS. */
export function StartCard({ tag, info, onStart }: Props) {
  if (!tag || !info) {
    return (
      <div className="startklar leer">
        <span className="eyebrow">Nächster Start</span>
        <div className="sk-name">Kein Trainingstag</div>
        <p className="muted tiny" style={{ margin: '6px 0 0' }}>
          Lege im Trainings-Tab einen Tag an, dann steht er hier startbereit.
        </p>
      </div>
    )
  }

  // Mehr als vier Namen sprengen auf Handybreite die Karte — der Rest wird
  // gezählt statt umgebrochen, die vollständige Liste steht ohnehin einen
  // Tap weiter in der Einheit selbst.
  const sichtbar = info.uebungen.slice(0, 4)
  const rest = info.uebungen.length - sichtbar.length

  const inhalt = (
    <>
      <span className="eyebrow">Nächster Start</span>
      <span className="sk-name">{tag.name}</span>
      <span className="sk-meta">
        <span>{info.uebungen.length} Übungen</span>
        <i />
        <span>{info.saetze} Sätze</span>
        {info.minuten != null && (
          <>
            <i />
            <span>meist {info.minuten} min</span>
          </>
        )}
      </span>
      {sichtbar.length > 0 && (
        <span className="sk-uebungen">
          {sichtbar.map(name => (
            <span key={name}>{name}</span>
          ))}
          {rest > 0 && <span className="mehr">+{rest}</span>}
        </span>
      )}
    </>
  )

  if (!onStart) return <div className="startklar">{inhalt}</div>

  return (
    <button type="button" className="startklar" onClick={onStart}>
      {inhalt}
      <span className="sk-pfeil" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}
