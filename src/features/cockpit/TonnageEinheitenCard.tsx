import type { EinheitPunkt } from './calc'
import { KachelKarte } from './KachelKarte'
import { ListChart } from './ListChart'
import { cssVars } from '../../lib/style'

export function TonnageEinheitenCard({ punkte }: { punkte: EinheitPunkt[] }) {
  if (punkte.length < 2) {
    return <KachelKarte titel="Tonnage je Einheit" wert="—" hinweis="ab zwei Einheiten" />
  }

  const gesamt = punkte.reduce((a, p) => a + p.tonnage, 0)
  const erledigtGesamt = punkte.reduce((a, p) => a + p.erledigt, 0)
  const geplantGesamt = punkte.reduce((a, p) => a + p.geplant, 0)
  // Wie bei der Trainingsdauer: neueste Einheit oben.
  const neuesteZuerst = [...punkte].reverse()

  return (
    <KachelKarte
      titel="Tonnage je Einheit"
      wert={Math.round((gesamt / 1000) * 10) / 10}
      einheit="t"
      hinweis={`über ${punkte.length} Einheiten`}
    >
      <ListChart
        ariaLabel="Bewegte Last je Einheit, neueste zuerst"
        zeilen={neuesteZuerst.map(p => ({
          id: p.sessionId,
          name: p.tagName,
          neben: `${p.datumLabel} · ${p.erledigt}/${p.geplant} Sätze`,
          wert: p.tonnage,
          wertText: `${Math.round(p.tonnage)} kg`,
          farbe: p.farbe,
        }))}
      />
      <div className="dstats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="dstat" style={cssVars({ '--f': 'var(--violet)' })}>
          <div className="k">Ø je Einheit</div>
          <div className="v">
            <span className="zahlglow">{Math.round(gesamt / punkte.length)}</span>
            <u> kg</u>
          </div>
          <div className="n">{Math.round(Math.max(...punkte.map(p => p.tonnage)))} kg im Maximum</div>
        </div>
        <div className="dstat" style={cssVars({ '--f': 'var(--good)' })}>
          <div className="k">Sätze abgehakt</div>
          <div className="v">
            <span className="zahlglow">{erledigtGesamt}</span>
            <u> von {geplantGesamt}</u>
          </div>
          <div className="n">im laufenden Block</div>
        </div>
      </div>
    </KachelKarte>
  )
}
