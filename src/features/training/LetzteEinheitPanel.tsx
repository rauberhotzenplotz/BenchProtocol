import type { LoggedSet } from '../../types/db'
import { satzE1rm } from './calc'

interface Props {
  saetze: LoggedSet[]
  label: string
}

/** Sichtbare Referenz auf die letzte Ausführung einer Übung — anders als
    die stille Vorbelegung der Eingabefelder über letzterSatz() (siehe
    calc.ts), die den Nutzer nie erfahren lässt, woher der Vorschlag kommt. */
export function LetzteEinheitPanel({ saetze, label }: Props) {
  if (!saetze.length) return null

  return (
    <div className="letzte-einheit">
      <div className="letzte-einheit-kopf">Letzte Einheit · {label}</div>
      <div className="letzte-einheit-liste">
        {saetze.map(s => {
          const rm = satzE1rm(s.kg, s.reps, s.rpe)
          return (
            <div key={s.id} className="letzte-einheit-zeile">
              <span className="nr">{s.position + 1}</span>
              <span className="mono">
                {s.kg ?? '—'}
                <em>kg</em>
              </span>
              <span className="mono">
                {s.reps ?? '—'}
                <em>Wdh.</em>
              </span>
              <span className="mono rm">{rm != null ? Math.round(rm) : '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
