import type { MuskelgruppenSatz } from '../features/training/calc'

// Dieselbe Farbidee wie tagFarbe() (dayColor.ts), nur über einen simplen
// String-Hash statt fester Listenposition — Muskelgruppen sind Freitext
// ohne feste Reihenfolge (siehe muskelgruppenDesTags in training/calc.ts).
const PALETTE = ['#35F0D0', '#8B7CFF', '#FF4D9D', '#3FE08A', '#FFC44D']

function muskelFarbe(gruppe: string): string {
  let hash = 0
  for (let i = 0; i < gruppe.length; i++) hash = (hash * 31 + gruppe.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

interface Props {
  gruppen: MuskelgruppenSatz[]
}

/** Themepassende Alternative zu einer anatomischen Körpersilhouette: eine
    Silhouette bräuchte ein festes Vokabular für muscle_group, das es
    nicht gibt (Freitext, siehe calc.ts) — stattdessen eine leuchtende
    Chip-Reihe, deren Größe die Satzanzahl je Gruppe zeigt. */
export function MuskelChips({ gruppen }: Props) {
  if (!gruppen.length) return null
  const max = Math.max(...gruppen.map(g => g.saetze))

  return (
    <div className="muskel-chips">
      {gruppen.map(g => {
        const farbe = muskelFarbe(g.gruppe)
        const skalierung = 0.55 + 0.45 * (g.saetze / max)
        return (
          <span
            key={g.gruppe}
            className="chip muskel-chip"
            style={{ borderColor: `${farbe}59`, background: `${farbe}15`, color: farbe }}
          >
            <i style={{ background: farbe, transform: `scale(${skalierung})`, boxShadow: `0 0 6px ${farbe}` }} />
            {g.gruppe}
            <em>{g.saetze}</em>
          </span>
        )
      })}
    </div>
  )
}
