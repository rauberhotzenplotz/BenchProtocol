import { useRestTimer } from '../features/training/rest-timer-context'

function zeitText(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function RestTimerBar() {
  const { label, secondsLeft, totalSeconds, stop, addSeconds } = useRestTimer()
  if (label == null) return null

  const fertig = secondsLeft <= 0
  const anteil = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0

  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 14,
        maxWidth: 420,
        margin: '0 auto',
        zIndex: 80,
        borderColor: fertig ? 'var(--good)' : 'var(--line)',
        boxShadow: '0 12px 30px -12px rgba(0,0,0,.85)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono tiny muted" style={{ letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {fertig ? 'Pause vorbei' : 'Pause'} · {label}
          </div>
          <div
            style={{
              fontFamily: 'var(--f-display)',
              fontSize: 26,
              color: fertig ? 'var(--good)' : 'var(--neon)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {zeitText(secondsLeft)}
          </div>
          <div className="bar-track" style={{ marginTop: 4 }}>
            <div className="bar-fill" style={{ width: `${(anteil * 100).toFixed(0)}%`, background: 'linear-gradient(90deg,var(--violet),var(--neon))' }} />
          </div>
        </div>
        {!fertig && (
          <button className="btn sm ghost" onClick={() => addSeconds(15)} aria-label="15 Sekunden dazu">
            +15s
          </button>
        )}
        <button className="btn sm" onClick={stop} aria-label="Pause beenden">
          {fertig ? 'OK' : 'Überspringen'}
        </button>
      </div>
    </div>
  )
}
