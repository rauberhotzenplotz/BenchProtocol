import { useId } from 'react'
import { cssVars } from '../../lib/style'
import { achsenTeilung, type Regression } from './calc'

/* Die Diagramme des Statistik-Tabs.
 *
 * Weiterhin ohne Chart-Bibliothek: Gebraucht werden drei Formen, und die
 * üblichen Pakete bringen ein Layout-System, eine Animations-Schicht und
 * eine Theme-Verwaltung mit, die hier alle schon existieren. Ein
 * viewBox-SVG passt sich der Breite von selbst an — auf einem 375-px-
 * Schirm der einzige Punkt, der wirklich zählt.
 */

const NEON = 'var(--neon)'

export interface LinienPunkt {
  /** Beschriftung der x-Stelle, z. B. "W7". */
  label: string
  wert: number
}

/** Liniendiagramm mit Fläche, Achsen und optionaler Trendgeraden.

    Die y-Achse beginnt immer bei 0. Gegen das Minimum normiert sähen drei
    fast gleich große Wochen wie ein Gebirge aus — dieselbe Überlegung wie
    beim Sternbild im Cockpit. Wer Unterschiede im Promillebereich sehen
    will, liest die Zahlen. */
export function Liniendiagramm({
  punkte,
  einheit,
  farbe = NEON,
  trend,
  hoehe = 132,
  ariaLabel,
}: {
  punkte: LinienPunkt[]
  einheit: string
  farbe?: string
  /** Ausgleichsgerade, gestrichelt darübergelegt. */
  trend?: Regression | null
  hoehe?: number
  ariaLabel: string
}) {
  const id = useId().replace(/:/g, '')
  if (punkte.length < 2) return null

  const W = 320
  const H = hoehe
  const links = 40
  const unten = 18
  const oben = 8
  const breite = W - links - 4
  const flaeche = H - unten - oben

  const hoch = Math.max(...punkte.map(p => p.wert))
  const schritt = achsenTeilung(hoch)
  const deckel = Math.max(schritt, Math.ceil(hoch / schritt) * schritt)

  const x = (i: number) => links + (i / (punkte.length - 1)) * breite
  const y = (v: number) => oben + flaeche - (v / deckel) * flaeche

  const linie = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(' ')
  const fuellung = `${linie} L${x(punkte.length - 1).toFixed(1)} ${(oben + flaeche).toFixed(1)} L${x(0).toFixed(1)} ${(oben + flaeche).toFixed(1)} Z`

  const striche: number[] = []
  for (let v = 0; v <= deckel + 0.0001; v += schritt) striche.push(v)

  // Beschriftung ausdünnen: Auf 320 Einheiten Breite passen etwa sechs
  // Marken, bevor sie sich überlappen.
  const jede = Math.max(1, Math.ceil(punkte.length / 6))

  const kurz = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))

  return (
    <svg className="st-linie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`fl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={farbe} stopOpacity="0.28" />
          <stop offset="100%" stopColor={farbe} stopOpacity="0" />
        </linearGradient>
      </defs>

      {striche.map(v => (
        <g key={v}>
          <line className="st-gitter" x1={links} y1={y(v)} x2={W - 4} y2={y(v)} />
          <text className="st-achse" x={links - 6} y={y(v) + 3.5} textAnchor="end">
            {kurz(v)}
          </text>
        </g>
      ))}

      <path d={fuellung} fill={`url(#fl${id})`} />
      <path className="st-ser" d={linie} fill="none" stroke={farbe} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {trend && (
        // Gestrichelt und blass: Die Gerade ist eine Deutung der Punkte,
        // keine gemessene Größe — sie soll nicht wie eine zweite Messreihe
        // aussehen.
        <line
          className="st-trend"
          x1={x(0)}
          y1={y(Math.max(0, Math.min(deckel, trend.achsenabschnitt)))}
          x2={x(punkte.length - 1)}
          y2={y(Math.max(0, Math.min(deckel, trend.achsenabschnitt + trend.steigung * (punkte.length - 1))))}
        />
      )}

      {punkte.map((p, i) => (
        <circle
          key={i}
          className={'st-punkt' + (i === punkte.length - 1 ? ' letzt' : '')}
          cx={x(i)}
          cy={y(p.wert)}
          r={i === punkte.length - 1 ? 3.2 : 1.9}
          fill={farbe}
        />
      ))}

      {punkte.map((p, i) =>
        i % jede === 0 || i === punkte.length - 1 ? (
          <text key={p.label + i} className="st-achse" x={x(i)} y={H - 5} textAnchor="middle">
            {p.label}
          </text>
        ) : null,
      )}

      <text className="st-achse einheit" x={links - 6} y={oben - 1} textAnchor="end">
        {einheit}
      </text>
    </svg>
  )
}

export interface VerteilungsFach {
  name: string
  anteil: number
  zusatz: string
}

/** Verteilung als waagerechte Bahnen mit Prozentanteil.

    Bewusst kein Tortendiagramm: Anteile lassen sich als Länge deutlich
    genauer vergleichen als als Winkel, und die Namen stehen hier
    ungekürzt daneben statt in einer Legende. */
export function Verteilung({ faecher, farbe = NEON, ariaLabel }: { faecher: VerteilungsFach[]; farbe?: string; ariaLabel: string }) {
  const leer = faecher.every(f => f.anteil === 0)
  if (leer) return <p className="muted tiny" style={{ margin: 0 }}>Noch keine Sätze für diese Auswertung.</p>

  return (
    <div className="st-vert" role="img" aria-label={ariaLabel}>
      {faecher.map((f, i) => (
        <div className={'st-vz' + (f.anteil === 0 ? ' leer' : '')} key={f.name} style={cssVars({ '--i': i })}>
          <span className="st-vz-name">{f.name}</span>
          <div className="st-vz-bahn">
            {/* Bei 0 % gar kein Balken: Die Mindestbreite aus dem
                Stylesheet liess sonst einen Strich stehen, der nach
                "ein bisschen" aussah, wo nichts war. */}
            {f.anteil > 0 && <i style={{ width: `${(f.anteil * 100).toFixed(1)}%`, background: farbe }} />}
          </div>
          <span className="st-vz-wert">
            {(f.anteil * 100).toFixed(0)}
            <em>%</em>
          </span>
          <span className="st-vz-zusatz">{f.zusatz}</span>
        </div>
      ))}
    </div>
  )
}

/** Kleine stehende Balken — für die sieben Wochentage, wo die Reihenfolge
    selbst die Aussage ist und Namen nicht danebenpassen. */
export function Balkenreihe({
  werte,
  farbe = NEON,
  ariaLabel,
}: {
  werte: { name: string; wert: number; titel: string }[]
  farbe?: string
  ariaLabel: string
}) {
  const hoch = Math.max(...werte.map(w => w.wert), 1)
  return (
    <div className="st-balken" role="img" aria-label={ariaLabel}>
      {werte.map((w, i) => (
        <div className="st-bz" key={w.name} style={cssVars({ '--i': i })} title={w.titel}>
          <div className="st-bz-bahn">
            <i style={{ height: `${Math.max(3, (w.wert / hoch) * 100).toFixed(1)}%`, background: farbe }} />
          </div>
          <span className="st-bz-name">{w.name}</span>
          <span className="st-bz-wert">{w.wert || '—'}</span>
        </div>
      ))}
    </div>
  )
}
