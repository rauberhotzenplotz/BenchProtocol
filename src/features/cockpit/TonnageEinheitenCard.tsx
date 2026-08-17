import type { EinheitPunkt } from './calc'
import { BarChart } from './BarChart'
import { cssVars } from '../../lib/style'

export function TonnageEinheitenCard({ punkte }: { punkte: EinheitPunkt[] }) {
  if (punkte.length < 2) {
    return (
      <div className="card">
        <h3>
          <span className="tick" />
          Tonnage je Einheit
        </h3>
        <p className="muted tiny" style={{ padding: '26px 0', textAlign: 'center', margin: 0 }}>
          {punkte.length ? 'Erst eine Einheit erfasst — ab der zweiten wird daraus ein Verlauf.' : 'Sobald du im Training Gewichte einträgst, erscheint hier die bewegte Last je Einheit.'}
        </p>
      </div>
    )
  }

  const gesamt = punkte.reduce((a, p) => a + p.tonnage, 0)
  const tage = [...new Map(punkte.map(p => [p.tagName, p.farbe])).entries()]
  const erledigtGesamt = punkte.reduce((a, p) => a + p.erledigt, 0)
  const geplantGesamt = punkte.reduce((a, p) => a + p.geplant, 0)

  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Tonnage je Einheit · aus deinem Log
      </h3>
      <BarChart
        ariaLabel="Tonnage je Einheit"
        schrittRunden={500}
        yLabel={v => `${Math.round((v / 1000) * 10) / 10} t`}
        schnittLabel={v => `${Math.round(v)} kg`}
        punkte={punkte.map(p => ({
          label: p.wochenLabel,
          wert: p.tonnage,
          farbe: p.farbe,
          tipTitel: `${Math.round(p.tonnage)} kg`,
          tipZeilen: [`${p.tagName} · ${p.wochenLabel}`, `${p.erledigt}/${p.geplant} Sätze`],
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
      <div className="dstats" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="dstat" style={cssVars({ '--f': 'var(--neon)' })}>
          <div className="k">Bewegt gesamt</div>
          <div className="v">
            <span className="zahlglow">{Math.round((gesamt / 1000) * 10) / 10}</span>
            <u> t</u>
          </div>
          <div className="n">über {punkte.length} Einheiten</div>
        </div>
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
    </div>
  )
}
