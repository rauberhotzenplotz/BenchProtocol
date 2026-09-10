import type { DayWithExercises } from '../training/queries'
import type { StartInfo } from './calc'

interface Props {
  tag: DayWithExercises | null
  info: StartInfo | null
  /** Fehlt der Rückruf (kein Plan, kein Tag), bleibt die Karte eine reine
      Anzeige statt eines Knopfes, der ins Leere führt. */
  onStart?: () => void
}

/** Die Einstiegskarte des Cockpits: was als Nächstes ansteht, wie gross
    die Einheit ist und wie lange sie üblicherweise dauert — mit der ganzen
    Karte als Startfläche.

    Die Übungsnamen standen hier einmal mit darin. Sie waren die einzige
    Stelle der Karte, die umbrach und ihre Höhe vom Plan abhängig machte,
    und sie beantworteten eine Frage, die man an dieser Stelle nicht hat:
    Ob man startet, entscheidet der Tag, nicht die Liste darin.

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

  const inhalt = (
    <>
      <span className="eyebrow">Nächster Start</span>
      <span className="sk-name">{tag.name}</span>
      <span className="sk-meta">
        <span>{info.uebungen} Übungen</span>
        <i />
        <span>{info.saetze} Sätze</span>
        {info.minuten != null && (
          <>
            <i />
            <span>meist {info.minuten} min</span>
          </>
        )}
      </span>
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
