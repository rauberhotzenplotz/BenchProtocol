import type { EinheitPunkt } from './calc'
import { BarChart } from './BarChart'
import { cssVars } from '../../lib/style'

function minText(m: number): string {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return h ? `${h}:${String(r).padStart(2, '0')} h` : `${Math.round(m)} min`
}

export function DauerEinheitenCard({ punkte }: { punkte: EinheitPunkt[] }) {
  if (punkte.length < 2) {
    return (
      <div className="card">
        <h3>
          <span className="tick" />
          Trainingsdauer
        </h3>
        <p className="muted tiny" style={{ padding: '26px 0', textAlign: 'center', margin: 0 }}>
          Sobald du mindestens zwei Einheiten beendet hast, steht hier ihre Dauer im Verlauf.
        </p>
      </div>
    )
  }

  const schnitt = punkte.reduce((a, p) => a + p.minuten, 0) / punkte.length
  const tage = [...new Map(punkte.map(p => [p.tagName, p.farbe])).entries()]

  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Trainingsdauer · letzte {punkte.length} Einheiten
      </h3>
      <BarChart
        ariaLabel="Trainingsdauer der letzten Einheiten"
        schrittRunden={15}
        yLabel={v => Math.round(v).toString()}
        schnittLabel={v => minText(v)}
        punkte={punkte.map(p => ({
          label: p.datumLabel,
          wert: p.minuten,
          farbe: p.farbe,
          tipTitel: minText(p.minuten),
          tipZeilen: [`${p.tagName} · ${p.wochenLabel}`],
        }))}
      />
      <div className="legend" style={{ marginTop: 9 }}>
        {tage.map(([name, farbe]) => (
          <span key={name}>
            <i style={{ background: farbe }} />
            {name}
          </span>
        ))}
      </div>
      <div className="dstats" style={{ gridTemplateColumns: 'minmax(0,1fr)', maxWidth: 220 }}>
        <div className="dstat gesamt" style={cssVars({ '--f': 'var(--ink)' })}>
          <div className="k">Ø je Einheit</div>
          <div className="v">
            {Math.round(schnitt)}
            <u> min</u>
          </div>
          <div className="n">über {punkte.length} Einheiten</div>
        </div>
      </div>
    </div>
  )
}
