import type { EinheitPunkt } from './calc'
import { KachelKarte } from './KachelKarte'
import { ListChart } from './ListChart'

function minText(m: number): string {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return h ? `${h}:${String(r).padStart(2, '0')} h` : `${Math.round(m)} min`
}

export function DauerEinheitenCard({ punkte }: { punkte: EinheitPunkt[] }) {
  if (punkte.length < 2) {
    return <KachelKarte titel="Trainingsdauer" wert="—" hinweis="ab zwei Einheiten" />
  }

  const schnitt = punkte.reduce((a, p) => a + p.minuten, 0) / punkte.length
  // einheitenDaten() liefert aufsteigend nach Datum — für die Liste
  // umgedreht, damit die neueste Einheit ganz oben steht.
  const neuesteZuerst = [...punkte].reverse()

  return (
    <KachelKarte
      titel="Trainingsdauer"
      wert={Math.round(schnitt)}
      einheit="min"
      hinweis={`Ø über ${punkte.length} Einheiten`}
    >
      <ListChart
        ariaLabel="Trainingsdauer der letzten Einheiten, neueste zuerst"
        zeilen={neuesteZuerst.map(p => ({
          id: p.sessionId,
          name: p.tagName,
          neben: `${p.datumLabel} · ${p.wochenLabel}`,
          wert: p.minuten,
          wertText: minText(p.minuten),
          farbe: p.farbe,
        }))}
      />
    </KachelKarte>
  )
}
