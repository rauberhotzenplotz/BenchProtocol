import { useState } from 'react'

function zeitText(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Eine Ziffernstelle, die beim Wechsel nicht hart springt: die alte
    Ziffer fällt in sich zusammen (Skalierung gegen null), erst danach
    entsteht die neue daraus (Skalierung von null hoch) — sequenziell,
    nicht überlappend, siehe .gym-ziffer-lage in global.css. */
function Ziffer({ zeichen }: { zeichen: string }) {
  const [aktuell, setAktuell] = useState(zeichen)
  const [vorherige, setVorherige] = useState<string | null>(null)

  // Abgeleiteter Zustand direkt beim Rendern angepasst (React-empfohlenes
  // Muster für "State beim Prop-Wechsel zurücksetzen"), statt in einem
  // Effekt — vermeidet einen zusätzlichen Render-Zyklus nach dem Mount.
  if (zeichen !== aktuell) {
    setVorherige(aktuell)
    setAktuell(zeichen)
  }

  return (
    <span className="gym-ziffer">
      {vorherige != null && (
        <span key={'alt-' + vorherige} className="gym-ziffer-lage alt" onAnimationEnd={() => setVorherige(null)}>
          {vorherige}
        </span>
      )}
      <span key={'neu-' + aktuell} className="gym-ziffer-lage neu">
        {aktuell}
      </span>
    </span>
  )
}

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
      <div className="gym-zeit">
        {[...zeitText(Math.max(0, secondsLeft))].map((zeichen, i) => (
          <Ziffer key={i} zeichen={zeichen} />
        ))}
      </div>
    </div>
  )
}
