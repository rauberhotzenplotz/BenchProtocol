import { useId, useState } from 'react'
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

/** Ungefähre Breite eines Bandetiketts je Zeichen in viewBox-Einheiten
    (Monospace, 9,5 px plus Zeichenabstand) — reicht, um zwischen Name und
    Kurzform zu wählen, ohne den Text erst messen zu müssen. */
const ZEICHEN_BREITE = 6.4

/** Glatter Pfad durch alle Punkte, ohne über sie hinauszuschießen
    (monotone kubische Interpolation nach Fritsch–Carlson). Die Linie geht
    genau durch jeden Messwert, biegt sich dazwischen aber weich — und
    erfindet keine Spitze oder Senke, die in den Daten nicht steckt, wie
    es eine gewöhnliche Spline täte. */
function glatterPfad(p: { x: number; y: number }[]): string {
  if (p.length < 3) return p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')
  const n = p.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x))
  const m: number[] = [d[0]]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  let pfad = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1].x - p[i].x) / 3
    pfad += ` C${(p[i].x + dx).toFixed(1)} ${(p[i].y + m[i] * dx).toFixed(1)} ${(p[i + 1].x - dx).toFixed(1)} ${(p[i + 1].y - m[i + 1] * dx).toFixed(1)} ${p[i + 1].x.toFixed(1)} ${p[i + 1].y.toFixed(1)}`
  }
  return pfad
}

/** Verteilung als Kurve: auf der x-Achse ein Messwert (Prozent vom
    Bestwert, Wiederholungen …), auf der y-Achse die Zahl der Sätze, ein
    Punkt je vorkommendem Wert. Grundlage für Intensitätszonen und
    Wiederholungsbereiche, damit beide gleich aussehen und sich gleich
    bedienen.

    - Ohne `glatt` verbindet die Linie nur die belegten Werte — eine
      Lücke ist keine Null.
    - Mit `glatt` (siehe glaetten in calc.ts) zeigt die Linie die
      geglättete Kurve, und die rohen Zählungen stehen als blasse Punkte
      darunter, damit die Glättung nichts versteckt.

    Die Bänder liegen blass dahinter und tragen ihren Namen, wo Platz ist.
    Ziehen oder Antippen zeigt ein Fadenkreuz mit den Werten. */
export function VerteilungsKurve({
  punkte,
  glatt,
  baender,
  xSchritt,
  xText,
  tipTitel,
  ariaLabel,
}: {
  punkte: { x: number; saetze: number }[]
  glatt?: { x: number; wert: number }[]
  baender: readonly { von: number; bis: number; name: string; kurz: string }[]
  /** Abstand der Achsenmarken unten. */
  xSchritt: number
  /** Beschriftung einer Achsenmarke, z. B. "70 %" oder "10". */
  xText: (x: number) => string
  /** Überschrift im Tooltip, z. B. "72 % vom Bestwert". */
  tipTitel: (x: number) => string
  ariaLabel: string
}) {
  const id = useId().replace(/:/g, '')
  const [aktiv, setAktiv] = useState<number | null>(null)
  if (!punkte.length || (glatt && !glatt.length)) return <p className="st-leer">Noch keine Sätze für diese Auswertung.</p>

  const W = 320
  const H = 184
  const links = 30
  const rechts = 16
  const oben = 20
  const unten = 22
  const breite = W - links - rechts
  const flaeche = H - oben - unten

  // Bereich aus der geglätteten Kurve, wenn es eine gibt — sie reicht schon
  // etwas über die Daten hinaus. Sonst ein Drittel Achsenschritt Luft auf
  // beiden Seiten: Vorher begann die Achse genau am ersten Messwert, der
  // Punkt klebte am Rand und das Band daneben schrumpfte zum Streifen.
  const reihe = glatt ?? punkte
  const luft = glatt ? 0 : xSchritt / 3
  const xVon = Math.max(0, reihe[0].x - luft)
  const xBis = Math.max(xVon + xSchritt, reihe[reihe.length - 1].x + luft)
  const x = (v: number) => links + ((v - xVon) / (xBis - xVon)) * breite

  // Höhe nach den rohen Punkten: Sie liegen über einer Glättung, die ihre
  // Spitzen auf die Nachbarn verteilt.
  const hoch = Math.max(...punkte.map(p => p.saetze), 1)
  // Etwas Luft über der höchsten Stelle, damit sie nicht an die
  // Bandnamen stößt, und feinere Teilung als zuvor: Bei 21 Sätzen reichte
  // die Achse bis 30 und verschenkte ein Drittel der Höhe. Ganze Sätze —
  // keine Achsenmarke bei 2,5.
  const schritt = Math.max(1, Math.ceil(achsenTeilung(hoch * 1.1, 5)))
  const deckel = Math.ceil((hoch * 1.1) / schritt) * schritt
  const y = (n: number) => oben + flaeche * (1 - n / deckel)

  const linienPunkte = glatt ? glatt.map(p => ({ x: p.x, y: p.wert })) : punkte.map(p => ({ x: p.x, y: p.saetze }))
  const linie = glatterPfad(linienPunkte.map(p => ({ x: x(p.x), y: y(p.y) })))
  const ende = linienPunkte[linienPunkte.length - 1].x
  const fuellung = `${linie} L${x(ende).toFixed(1)} ${y(0).toFixed(1)} L${x(linienPunkte[0].x).toFixed(1)} ${y(0).toFixed(1)} Z`

  const yStriche: number[] = []
  for (let v = 0; v <= deckel; v += schritt) yStriche.push(v)
  const xStriche: number[] = []
  for (let v = Math.ceil(xVon / xSchritt) * xSchritt; v <= xBis + 1e-9; v += xSchritt) xStriche.push(v)

  const tip = aktiv != null ? linienPunkte[aktiv] : null
  const rohBei = (v: number) => punkte.find(q => q.x === v)?.saetze ?? 0
  const bandBei = (v: number) => baender.find(b => v >= b.von && v < b.bis)

  /** Nächster Punkt der Linie zur Zeigerposition — über die gesamte Breite,
      damit man auf dem Handy nicht den dünnen Punkt treffen muss. */
  const zeigen = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const svgX = ((e.clientX - box.left) / box.width) * W
    const v = xVon + ((svgX - links) / breite) * (xBis - xVon)
    let naechster = 0
    linienPunkte.forEach((q, i) => {
      if (Math.abs(q.x - v) < Math.abs(linienPunkte[naechster].x - v)) naechster = i
    })
    setAktiv(naechster)
  }

  return (
    <div className="st-zonen-feld" onPointerLeave={() => setAktiv(null)}>
      <svg className="st-linie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`vk${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEON} stopOpacity="0.22" />
            <stop offset="100%" stopColor={NEON} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Bänder abwechselnd hell und dunkel, beschriftet, wo Platz ist. */}
        {baender.map((band, i) => {
          const a = Math.max(band.von, xVon)
          const b = Math.min(band.bis, xBis)
          if (b <= a) return null
          const w = x(b) - x(a)
          const passt = (t: string) => t.length * ZEICHEN_BREITE <= w - 4
          const text = passt(band.name) ? band.name : passt(band.kurz) ? band.kurz : null
          return (
            <g key={band.name}>
              <rect className={'st-zband' + (i % 2 ? ' dunkel' : '')} x={x(a)} y={oben} width={w} height={flaeche} />
              {text && (
                <text className="st-achse st-band-lab" x={x(a) + w / 2} y={oben - 7} textAnchor="middle">
                  <title>{band.name}</title>
                  {text}
                </text>
              )}
            </g>
          )
        })}

        {yStriche.map(v => (
          <g key={v}>
            <line className="st-gitter" x1={links} y1={y(v)} x2={W - rechts} y2={y(v)} />
            <text className="st-achse" x={links - 6} y={y(v) + 3.5} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xStriche.map(v => (
          <text key={v} className="st-achse" x={x(v)} y={H - 6} textAnchor="middle">
            {xText(v)}
          </text>
        ))}

        <path d={fuellung} fill={`url(#vk${id})`} />
        <path className="st-ser" d={linie} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {punkte.map(p => (
          <circle
            key={p.x}
            className={glatt ? 'st-ik-roh' : 'st-ik-punkt'}
            cx={x(p.x)}
            cy={y(p.saetze)}
            r={glatt ? 2.2 : 3.4}
          />
        ))}

        {tip && (
          <g>
            <line className="st-ik-kreuz" x1={x(tip.x)} y1={oben} x2={x(tip.x)} y2={y(0)} />
            <circle className="st-ik-aktiv" cx={x(tip.x)} cy={y(tip.y)} r={4.5} />
          </g>
        )}

        <rect
          className="st-treffer"
          x={links}
          y={oben}
          width={breite}
          height={flaeche + unten}
          onPointerMove={zeigen}
          onPointerDown={zeigen}
        />
      </svg>

      {tip && (
        <div
          className="st-tip"
          style={{ left: `clamp(70px, ${((x(tip.x) / W) * 100).toFixed(1)}%, calc(100% - 70px))` }}
          role="status"
        >
          <b>{tipTitel(tip.x)}</b>
          <span className="st-tip-zeile">
            {rohBei(tip.x) === 0
              ? 'hier kein Satz'
              : `${rohBei(tip.x)} ${rohBei(tip.x) === 1 ? 'Satz' : 'Sätze'}${glatt ? ' genau hier' : ''}`}
          </span>
          {glatt && (
            <span className="st-tip-zeile">geglättet ≈ {tip.y.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</span>
          )}
          {/* Bandnamen nur, wenn es Begriffe sind — "70–80" wiederholte
              bloß, was die Überschrift schon sagt. */}
          {bandBei(tip.x) && !/^[<\d]/.test(bandBei(tip.x)!.name) && (
            <span className="st-tip-zeile">{bandBei(tip.x)!.name}</span>
          )}
        </div>
      )}

      <table className="st-sr">
        <caption>{ariaLabel}</caption>
        <tbody>
          {punkte.map(p => (
            <tr key={p.x}>
              <th>{xText(p.x)}</th>
              <td>{p.saetze} Sätze</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface Saeule {
  id: string
  /** Kurze Beschriftung unter der Säule, z. B. "17.10.". */
  label: string
  wert: number
  /** Zeilen für den Tooltip — die erste ist die Überschrift. */
  details: string[]
}

/** Stehende Säulen in zeitlicher Folge, älteste links — für Werte je
    Einheit (Tonnage, Dauer). Eine Farbe für alle: Die Säulen zeigen eine
    Größe über die Zeit, keine verschiedenen Reihen. Welcher Tag es war,
    steht im Tooltip.

    Gestrichelt der Durchschnitt, damit man ohne Rechnen sieht, welche
    Einheit darüber oder darunter lag. Die y-Achse beginnt bei 0 — sonst
    sähe eine Einheit mit 10 % weniger aus wie halb so viel. */
export function Saeulendiagramm({
  saeulen,
  einheit,
  format = (n: number) => Math.round(n).toLocaleString('de-DE'),
  achsenFormat,
  farbe = NEON,
  ariaLabel,
}: {
  saeulen: Saeule[]
  einheit: string
  format?: (n: number) => string
  /** Kürzere Schreibweise für die Achse, z. B. "15 t" statt "15.000". */
  achsenFormat?: (n: number) => string
  farbe?: string
  ariaLabel: string
}) {
  const [aktiv, setAktiv] = useState<number | null>(null)
  if (!saeulen.length) return null

  const W = 320
  const H = 172
  const links = 40
  const rechts = 4
  const oben = 16
  const unten = 20
  const flaeche = H - oben - unten
  const hoch = Math.max(...saeulen.map(s => s.wert))
  const schritt = achsenTeilung(hoch, 3)
  const deckel = Math.max(schritt, Math.ceil(hoch / schritt) * schritt)
  const feld = (W - links - rechts) / saeulen.length
  const breite = Math.min(24, feld * 0.62)
  const x = (i: number) => links + feld * i + (feld - breite) / 2
  const y = (v: number) => oben + flaeche * (1 - v / deckel)
  const RADIUS = Math.min(4, breite / 2)
  const mittel = saeulen.reduce((a, s) => a + s.wert, 0) / saeulen.length

  const striche: number[] = []
  for (let v = 0; v <= deckel + 0.0001; v += schritt) striche.push(v)
  // Bei vielen Säulen nur jede zweite (bzw. dritte) beschriften, sonst
  // laufen die Daten ineinander.
  const jede = saeulen.length > 16 ? 3 : saeulen.length > 8 ? 2 : 1

  const tip = aktiv != null ? saeulen[aktiv] : null
  const tipLinks = aktiv != null ? ((x(aktiv) + breite / 2) / W) * 100 : 0

  return (
    <div className="st-zonen-feld" onPointerLeave={() => setAktiv(null)}>
      <svg className="st-linie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {striche.map(v => (
          <g key={v}>
            <line className="st-gitter" x1={links} y1={y(v)} x2={W - rechts} y2={y(v)} />
            <text className="st-achse" x={links - 6} y={y(v) + 3.5} textAnchor="end">
              {(achsenFormat ?? format)(v)}
            </text>
          </g>
        ))}

        {saeulen.map((s, i) => {
          const h = Math.max(1.5, y(0) - y(s.wert))
          const top = y(0) - h
          const r = Math.min(RADIUS, h)
          return (
            <g key={s.id} className={'st-zs' + (aktiv != null && aktiv !== i ? ' leise' : '')}>
              {/* Oben gerundet, unten flach auf der Grundlinie. */}
              <path
                d={`M${x(i)} ${y(0)} V${top + r} Q${x(i)} ${top} ${x(i) + r} ${top} H${x(i) + breite - r} Q${x(i) + breite} ${top} ${x(i) + breite} ${top + r} V${y(0)} Z`}
                fill={farbe}
              />
              {i % jede === (saeulen.length - 1) % jede && (
                <text className="st-achse" x={x(i) + breite / 2} y={H - 6} textAnchor="middle">
                  {s.label}
                </text>
              )}
              <rect
                className="st-treffer"
                x={links + feld * i}
                y={oben}
                width={feld}
                height={flaeche + unten}
                onPointerEnter={() => setAktiv(i)}
                onClick={() => setAktiv(a => (a === i ? null : i))}
              />
            </g>
          )
        })}

        {/* Durchschnitt über die Säulen gelegt, aber ohne Trefferfläche —
            er soll das Antippen der Säulen nicht abfangen. */}
        <line className="st-trend st-mittel" x1={links} y1={y(mittel)} x2={W - rechts} y2={y(mittel)} />
        <text className="st-achse einheit" x={W - rechts} y={y(mittel) - 4} textAnchor="end">
          Ø {format(mittel)} {einheit}
        </text>
      </svg>

      {tip && (
        <div className="st-tip" style={{ left: `clamp(70px, ${tipLinks.toFixed(1)}%, calc(100% - 70px))` }} role="status">
          <b>{tip.details[0]}</b>
          {tip.details.slice(1).map(d => (
            <span key={d} className="st-tip-zeile">
              {d}
            </span>
          ))}
        </div>
      )}

      <table className="st-sr">
        <caption>{ariaLabel}</caption>
        <tbody>
          {saeulen.map(s => (
            <tr key={s.id}>
              <th>{s.details[0]}</th>
              <td>
                {format(s.wert)} {einheit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
