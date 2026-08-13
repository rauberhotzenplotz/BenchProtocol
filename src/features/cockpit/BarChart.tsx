import { useState } from 'react'

export interface BarChartPunkt {
  label: string
  wert: number
  farbe: string
  tipTitel: string
  tipZeilen: string[]
}

interface Props {
  punkte: BarChartPunkt[]
  schrittRunden: number
  yLabel: (wert: number) => string
  schnittLabel: (wert: number) => string
  ariaLabel: string
}

/** Handgerollter SVG-Balkenchart — Pendant zu dauerChart()/tonnageChart()
    aus der alten App: Gitterlinien, Balken mit Farbverlauf + Glow, Ø-Linie,
    X-Achsenbeschriftung, Tooltip beim Überfahren. Die Tooltip-Position wird
    hier über Prozentwerte relativ zum viewBox gesetzt statt über gemessene
    Pixel — skaliert dadurch automatisch mit der gerenderten Größe mit. */
export function BarChart({ punkte, schrittRunden, yLabel, schnittLabel, ariaLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  if (punkte.length < 2) return null

  const W = 660
  const H = 200
  const P = { t: 16, r: 14, b: 26, l: 46 }
  const iw = W - P.l - P.r
  const ih = H - P.t - P.b
  const hoch = Math.max(...punkte.map(p => p.wert))
  const skala = Math.ceil((hoch * 1.12) / schrittRunden) * schrittRunden || schrittRunden
  const schnitt = punkte.reduce((a, p) => a + p.wert, 0) / punkte.length
  const bw = Math.max(8, Math.min(40, iw / punkte.length - 8))
  const X = (i: number) => P.l + iw * ((i + 0.5) / punkte.length)
  const Y = (v: number) => P.t + ih * (1 - v / skala)

  const farben = [...new Set(punkte.map(p => p.farbe))]
  const gradId = (f: string) => `bc${farben.indexOf(f)}`
  const ys = Y(schnitt)

  return (
    <div className="chartwrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="chart dchart" role="img" aria-label={ariaLabel}>
        <defs>
          {farben.map(f => (
            <linearGradient key={f} id={gradId(f)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={f} stopOpacity="1" />
              <stop offset="100%" stopColor={f} stopOpacity=".28" />
            </linearGradient>
          ))}
        </defs>
        {[0, 1, 2, 3].map(k => {
          const v = (skala * k) / 3
          const y = Y(v)
          return (
            <g key={k}>
              <line className="gridline" x1={P.l} y1={y} x2={W - P.r} y2={y} />
              <text className="axis" x={P.l - 7} y={y + 3.4} textAnchor="end">
                {yLabel(v)}
              </text>
            </g>
          )
        })}
        {punkte.map((p, i) => {
          const y = Y(p.wert)
          const h = Math.max(2, P.t + ih - y)
          return (
            <rect
              key={i}
              className="dbar"
              x={X(i) - bw / 2}
              y={y}
              width={bw}
              height={h}
              rx={Math.min(3, bw / 2)}
              fill={`url(#${gradId(p.farbe)})`}
              style={{ animationDelay: `${i * 28}ms`, filter: `drop-shadow(0 0 6px ${p.farbe}88)` }}
            />
          )
        })}
        <line className="avg" x1={P.l} y1={ys} x2={W - P.r} y2={ys} stroke="var(--ink-3)" />
        <text className="avgtxt" x={W - P.r} y={ys - 6} textAnchor="end" fill="var(--ink-3)">
          Ø {schnittLabel(schnitt)}
        </text>
        {[0, punkte.length - 1].map((i, k) => (
          <text key={k} className="axis" x={X(i)} y={H - 7} textAnchor={k ? 'end' : 'start'}>
            {punkte[i].label}
          </text>
        ))}
        <rect className={'cursorbar' + (hover != null ? ' on' : '')} x={hover != null ? X(hover) - bw / 2 : 0} y={P.t} width={bw} height={ih} rx={3} />
        {punkte.map((_, i) => (
          <rect
            key={i}
            className="dbar-hit"
            x={P.l + iw * (i / punkte.length)}
            y={P.t}
            width={iw / punkte.length}
            height={ih}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover != null && (
        <div
          className="ctip on"
          style={{
            left: `${(X(hover) / W) * 100}%`,
            top: `${(Y(punkte[hover].wert) / H) * 100}%`,
          }}
        >
          <b>{punkte[hover].tipTitel}</b>
          {punkte[hover].tipZeilen.map((z, i) => (i === 0 ? <s key={i}>{z}</s> : <i key={i}>{z}</i>))}
        </div>
      )}
    </div>
  )
}
