function zeitText(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Großer Ring-Countdown fürs Gym-Modus — dieselbe Zeit wie die kleine
    Leiste, nur großflächig fürs Vollbild (.gym-ring/.gym-zeit aus dem
    portierten CSS). */
export function GymRing({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const anteil = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0
  const r = 45
  const umfang = 2 * Math.PI * r
  const offset = umfang * (1 - anteil)
  const stufe = secondsLeft <= 5 ? 'crit' : secondsLeft <= 15 ? 'warn' : ''

  return (
    <div className="gym-ringbox">
      <svg className={'gym-ring' + (stufe ? ' ' + stufe : '')} viewBox="0 0 100 100">
        <circle className="bg" cx="50" cy="50" r={r} strokeWidth={4} />
        <circle className="halo" cx="50" cy="50" r={r} strokeDasharray={umfang} strokeDashoffset={offset} />
        <circle className="fg" cx="50" cy="50" r={r} strokeDasharray={umfang} strokeDashoffset={offset} />
      </svg>
      <div className="gym-zeit">{zeitText(Math.max(0, secondsLeft))}</div>
    </div>
  )
}
