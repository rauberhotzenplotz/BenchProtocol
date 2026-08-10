/** Kleine, handgerollte Trendlinie ohne Chart-Bibliothek — Pendant zu
    sparkline() aus der alten App, reduziert auf das Nötige. */
export function Sparkline({ values, color = '#35F0D0' }: { values: number[]; color?: string }) {
  const echte = values.filter(v => Number.isFinite(v))
  if (echte.length < 2) return null

  const W = 140
  const H = 34
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const spanne = hi - lo || 1
  const punkte = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - lo) / spanne) * (H - 6) - 3
    return [x, y] as const
  })
  const pfad = punkte.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', marginTop: 6 }} aria-hidden="true">
      <path d={pfad} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={punkte[punkte.length - 1][0]} cy={punkte[punkte.length - 1][1]} r={2.4} fill={color} />
    </svg>
  )
}
