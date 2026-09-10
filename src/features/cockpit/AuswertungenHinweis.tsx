import { Link } from 'react-router-dom'

/** Wegweiser zum Statistik-Tab.

    Die Auswertungen lagen früher hier: Muskel-Heatmap, Druck-Zug-Bilanz,
    Sternbild und vier Kacheln hinter einem Aufklapper. Sie sind in einen
    eigenen Tab gezogen, weil sie hier weder zu finden noch groß genug zum
    Ablesen waren.

    Statt sie kommentarlos verschwinden zu lassen, steht hier ein Verweis:
    Wer sie im Cockpit gesucht hat, findet sie sonst nicht wieder. */
export function AuswertungenHinweis() {
  return (
    <Link className="card ausw-hinweis" to="/statistik">
      <span className="ausw-hinweis-text">
        <b>Auswertungen</b>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4v16h16" />
        <path d="M7 15l4-5 3 3 5-7" />
      </svg>
    </Link>
  )
}
