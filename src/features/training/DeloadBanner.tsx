import type { Plan } from '../../types/db'
import { blockWoche } from './calc'

/** Hinweis vor dem Trainingsstart in der Deload-Woche eines Bankfokus-
    Blocks — verschwindet, sobald die Einheit läuft (siehe SessionView). */
export function DeloadBanner({ plan }: { plan: Plan }) {
  if (plan.typ !== 'bench' || blockWoche(plan.week) !== 4) return null
  return (
    <div className="deload-banner">
      <b>Deload-Woche</b>
      <p>Weniger Gewicht, weniger Sätze — bewusst leichter, damit der nächste Block wieder frisch startet.</p>
    </div>
  )
}
