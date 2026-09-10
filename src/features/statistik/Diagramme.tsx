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

const NEON = 'var(--akzent)'

export interface LinienPunkt {
  /** Beschriftung der x-Stelle, z. B. "W7". */
  label: string
  wert: number
}

/** Streuwert-Netz aus einem Punkt: zwei Trabanten je Messwert, deren
    Versatz sich aus dem Wert selbst ergibt statt aus Zufall. Dadurch steht
    das Netz bei jedem Zeichnen an derselben Stelle -- ein Diagramm, das
    bei jedem Rendern anders aussieht, waere kein Diagramm.

    Der Versatz ist bewusst klein und an die Schwankung zwischen zwei
    Wochen gekoppelt: Wo sich viel bewegt, streut das Netz weiter. */
function trabanten(px: number, py: number, i: number, streuung: number) {
  const w1 = Math.sin(i * 2.399) * streuung
  const w2 = Math.cos(i * 1.771) * streuung
  const w3 = Math.sin(i * 3.117 + 1.2) * streuung
  const w4 = Math.cos(i * 2.653 + 0.7) * streuung
  return [
    { x: px + w1 * 1.6, y: py + w2 },
    { x: px + w3 * 1.6, y: py - w4 },
  ]
}

/** Verlaufsdiagramm im Stil der Vorlage: ein Netz aus Streuwerten im
    Hintergrund, darueber die Linie mit einem Ring je Messpunkt, und in
    den unteren Ecken Start- und Endwert.

    Die y-Achse beginnt immer bei 0. Gegen das Minimum normiert saehen drei
    fast gleich grosse Wochen wie ein Gebirge aus. Zahlen an der Achse gibt
    es keine mehr: Die beiden Eckwerte sagen, worum es geht, und wer es
    genau wissen will, liest die Kennzahlenzeile unter dem Diagramm. */
export function Liniendiagramm({
  punkte,
  einheit,
  farbe = NEON,
  trend,
  hoehe = 158,
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
  const links = 6
  const rechts = 6
  const unten = 22
  const oben = 16
  const breite = W - links - rechts
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

  // Streuung des Netzes: die mittlere Aenderung von Punkt zu Punkt, in
  // Bildeinheiten. Bei einer flachen Reihe bleibt das Netz eng am Verlauf.
  const spruenge = punkte.slice(1).map((p, i) => Math.abs(y(p.wert) - y(punkte[i].wert)))
  const streuung = Math.min(26, Math.max(9, spruenge.reduce((a, b) => a + b, 0) / Math.max(1, spruenge.length)))

  const netz = punkte.flatMap((p, i) => trabanten(x(i), y(p.wert), i, streuung))
  const naehe = breite / Math.max(2, punkte.length - 1) * 1.9
  const faeden: [number, number][] = []
  for (let a = 0; a < netz.length; a++) {
    for (let b = a + 1; b < netz.length; b++) {
      const dx = netz[a].x - netz[b].x
      const dy = netz[a].y - netz[b].y
      if (Math.hypot(dx, dy) < naehe) faeden.push([a, b])
    }
  }

  const ersteZahl = punkte[0].wert
  const letzteZahl = punkte[punkte.length - 1].wert
  // Deutsche Tausenderpunkte statt "12k": Der Eckwert ist eine Angabe,
  // keine Achsenmarke -- er darf die Stelle genau nennen.
  const kurz = (v: number) => Math.round(v).toLocaleString('de-DE')

  return (
    <svg className="st-linie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={`fl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={farbe} stopOpacity="0.13" />
          <stop offset="100%" stopColor={farbe} stopOpacity="0" />
        </linearGradient>
      </defs>

      {striche.map(v => (
        <line key={v} className="st-gitter" x1={links} y1={y(v)} x2={W - rechts} y2={y(v)} />
      ))}

      {/* Das Netz liegt hinter allem: es traegt die Stimmung, nicht die
          Aussage. */}
      <g className="st-netz" style={{ color: farbe }}>
        {faeden.map(([a, b], i) => (
          <line key={i} x1={netz[a].x} y1={netz[a].y} x2={netz[b].x} y2={netz[b].y} />
        ))}
        {netz.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} />
        ))}
      </g>

      <path d={fuellung} fill={`url(#fl${id})`} />

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

      <path className="st-ser" d={linie} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {punkte.map((p, i) => (
        <circle
          key={i}
          className={'st-knoten' + (i === punkte.length - 1 ? ' letzt' : '')}
          cx={x(i)}
          cy={y(p.wert)}
          r={i === punkte.length - 1 ? 4.4 : 3.2}
        />
      ))}

      {/* Der aktuelle Wert steht am letzten Knoten, die beiden Eckwerte
          unten -- genau wie in der Vorlage. */}
      <text className="st-wert" x={W - rechts} y={oben - 5} textAnchor="end">
        {kurz(letzteZahl)} {einheit}
      </text>
      <text className="st-eck" x={links} y={H - 12} textAnchor="start">
        {kurz(ersteZahl)} {einheit}
      </text>
      <text className="st-eck lab" x={links} y={H - 2} textAnchor="start">
        START
      </text>
      <text className="st-eck" x={W - rechts} y={H - 12} textAnchor="end">
        {kurz(letzteZahl)} {einheit}
      </text>
      <text className="st-eck lab" x={W - rechts} y={H - 2} textAnchor="end">
        AKTUELL
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
