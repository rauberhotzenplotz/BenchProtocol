import type { ReactNode } from 'react'

export interface BandWert {
  label: string
  wert: ReactNode
  einheit?: string
  /** Hebt genau einen Wert neon hervor — den, um den sich der Plan dreht. */
  fuehrend?: boolean
}

/** Die Kernzahlen als ein ruhiges Band statt als Reihe gleich schwerer
    Karten: sechs umrandete Kästen nebeneinander geben dem Auge keinen
    Halt, weil jeder gleich laut ist. Hier trennt nur eine Haarlinie, und
    die Startkarte darüber bleibt die einzige Fläche mit vollem Gewicht. */
export function KennzahlBand({ werte }: { werte: BandWert[] }) {
  return (
    <div className="kpiband">
      {werte.map(w => (
        <div key={w.label} className={'kpiband-wert' + (w.fuehrend ? ' fuehrend' : '')}>
          <span className="zahl">
            {w.wert}
            {w.einheit && <u>{w.einheit}</u>}
          </span>
          <span className="lab">{w.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Klappt die Diagramme weg, bis man sie sehen will. Die Übersicht soll
    beim Öffnen der App eine Handlung und drei Zahlen zeigen, nicht fünf
    Auswertungen — die stehen einen Tipp weiter. */
