import { Liniendiagramm } from '../statistik/Diagramme'

/** Verlauf des e1RM über die Wochen eines Blocks.

    Baut auf demselben Liniendiagramm auf wie der Statistik-Tab, statt eine
    zweite handgerollte Linie zu pflegen: Vorher hatte diese Seite eine
    eigene Kurve mit eigener Optik, und jede Designänderung musste an zwei
    Stellen nachgezogen werden -- beim letzten Umbau ist genau das
    passiert. Ein Verlauf sieht jetzt überall gleich aus. */
export function E1rmVerlauf({ punkte }: { punkte: { woche: number; e1rm: number }[] }) {
  if (punkte.length < 2) {
    return <p className="muted tiny">Mindestens zwei Wochen mit eingetragenem Satz nötig.</p>
  }

  return (
    <Liniendiagramm
      punkte={punkte.map(p => ({ label: `W${p.woche}`, wert: p.e1rm }))}
      einheit="kg"
      farbe="var(--ton-b)"
      hoehe={132}
      ariaLabel="Geschätztes Einwiederholungsmaximum je Woche"
    />
  )
}
