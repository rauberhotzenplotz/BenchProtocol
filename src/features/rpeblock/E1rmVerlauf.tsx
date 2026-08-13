import { cssVars } from '../../lib/style'

/** Handgerollte Verlaufslinie des e1RM über die Wochen eines Blocks —
    Pendant zu components/Sparkline.tsx, nur mit Wochen-Beschriftung. */
export function E1rmVerlauf({ punkte }: { punkte: { woche: number; e1rm: number }[] }) {
  if (punkte.length < 2) {
    return <p className="muted tiny">Mindestens zwei Wochen mit eingetragenem Satz nötig für den Verlauf.</p>
  }

  const W = 320
  const H = 90
  const PAD = 10
  const werte = punkte.map(p => p.e1rm)
  const lo = Math.min(...werte)
  const hi = Math.max(...werte)
  const spanne = hi - lo || 1
  const xy = punkte.map((p, i) => {
    const x = PAD + (i / (punkte.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((p.e1rm - lo) / spanne) * (H - PAD * 2)
    return [x, y] as const
  })
  const pfad = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const laenge = xy.slice(1).reduce((sum, [x, y], i) => {
    const [px, py] = xy[i]
    return sum + Math.hypot(x - px, y - py)
  }, 0)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }} className="chart" aria-hidden="true">
        <path
          className="ser"
          d={pfad}
          fill="none"
          stroke="var(--neon)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={cssVars({ '--len': laenge })}
        />
        {xy.map(([x, y], i) => (
          <circle key={i} className="dot" cx={x} cy={y} r={3.2} fill="var(--neon)" />
        ))}
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
        {punkte.map(p => (
          <span key={p.woche} className="mono tiny muted">
            W{p.woche} · {p.e1rm.toFixed(1)} kg
          </span>
        ))}
      </div>
    </div>
  )
}
