/** Schloss-Knopf: schützt Werte, die man nur selten ändert (Ausgangsdaten,
    Ziel), vor versehentlichem Antippen. Gesperrt zeigt nur den Wert, erst
    ein Antippen des Schlosses macht ihn wieder bearbeitbar — und sperrt
    sich nicht von selbst wieder zu, das wäre bei mehreren Feldern in Folge
    (z. B. Gewicht, dann Wdh., dann RPE) nur lästig. */
export function SperrKnopf({ gesperrt, onToggle }: { gesperrt: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={'sperrknopf' + (gesperrt ? '' : ' offen')}
      onClick={onToggle}
      aria-pressed={!gesperrt}
      title={gesperrt ? 'Zum Bearbeiten entsperren' : 'Sperren'}
      aria-label={gesperrt ? 'Zum Bearbeiten entsperren' : 'Sperren'}
    >
      {gesperrt ? (
        <svg viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 7.5-2.5" />
        </svg>
      )}
    </button>
  )
}
