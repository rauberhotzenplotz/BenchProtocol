import { cssVars } from '../../lib/style'

export interface ListChartZeile {
  id: string
  name: string
  /** Kleiner Zusatz hinter dem Namen, z. B. Datum oder Woche. */
  neben?: string
  wert: number
  wertText: string
  farbe: string
}

/** Balkenliste von oben nach unten — Nachfolger des früheren stehenden
    SVG-Balkencharts. Auf dem Handy ist das der bessere Weg: die Namen
    stehen waagerecht und ungekürzt, jede Zeile trägt ihren eigenen Wert,
    und die Reihenfolge ist die eigentliche Aussage — oben steht, was
    zuerst interessiert (neueste Einheit bzw. längste Übung). Die
    Balkenlänge bezieht sich immer auf den größten Wert der Liste. */
export function ListChart({ zeilen, ariaLabel }: { zeilen: ListChartZeile[]; ariaLabel: string }) {
  if (!zeilen.length) return null
  const hoch = Math.max(...zeilen.map(z => z.wert)) || 1

  return (
    <div className="lchart" role="img" aria-label={ariaLabel}>
      {zeilen.map((z, i) => (
        <div className="lz" key={z.id} style={cssVars({ '--i': i })}>
          <div className="lz-kopf">
            <span className="lz-name">{z.name}</span>
            {z.neben && <span className="lz-neben">{z.neben}</span>}
            <span className="lz-wert">{z.wertText}</span>
          </div>
          <div className="lz-bahn">
            <i
              style={{
                // Mindestbreite, damit auch eine sehr kurze Einheit noch
                // als Balken erkennbar bleibt statt als leere Bahn.
                width: `${Math.max(2, (z.wert / hoch) * 100).toFixed(1)}%`,
                background: z.farbe,
                boxShadow: `0 0 8px ${z.farbe}66`,
                animationDelay: `${i * 34}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
