import { useState } from 'react'
import { cssVars } from '../../lib/style'
import { WDH_BAENDER } from './calc'

/* Wiederholungsbereiche als Punkt-Histogramm: jeder Satz ein Punkt, über
   seiner Wiederholungszahl gestapelt. Nichts geglättet, nichts gebündelt —
   man sieht wirklich die einzelnen Sätze.

   Gefärbt nach Bereich in einer Stufenfolge eines Farbtons: schwer (wenige
   Wiederholungen) hell, leicht (viele) gedämpft. Die Bereiche haben eine
   Reihenfolge, deshalb Abstufung statt fünf verschiedener Farben; die
   Stufen sind gegen die dunkle Kartenfläche geprüft (gleichmäßig
   ansteigende Helligkeit, die dunkelste hebt sich noch vom Grund ab).

   Darunter derselbe Inhalt als Anteilsleiste — die Kurzfassung. Antippen
   einer Säule oder eines Abschnitts hebt sie hervor und nennt die Zahlen. */

/** Leicht → schwer, in der Reihenfolge der Bänder von hinten gelesen. */
const STUFEN = ['#096058', '#0d8378', '#24a898', '#3fcab7', '#79ecd7']

/** Die Bereiche aus WDH_BAENDER (calc.ts) — dort liegen die Grenzen auf
    halben Zahlen, hier als ganze Wiederholungen, dazu die Farbe. Index 0 =
    Maximalkraft (schwer, hell). */
const BEREICHE = WDH_BAENDER.map((b, i) => ({
  name: b.name,
  von: Math.ceil(b.von),
  bis: b.bis > 100 ? Infinity : Math.floor(b.bis),
  farbe: STUFEN[STUFEN.length - 1 - i],
}))

const bereichVon = (wdh: number) => BEREICHE.findIndex(b => wdh >= b.von && wdh <= b.bis)

/** Mehr Wiederholungen als hier stehen in einer gemeinsamen Säule "25+" —
    eine Achse bis 50 nur für einen einzelnen Satz wäre leerer Platz. */
const ACHSE_BIS = 25

/** Höchstens so viele Punkte übereinander; darüber steht ein Punkt für
    mehrere Sätze, und die Fußzeile sagt es. */
const MAX_STAPEL = 28

type Auswahl = { art: 'bereich'; i: number } | { art: 'wdh'; wdh: number } | null

export function WiederholungsSpektrum({ kurve }: { kurve: { wdh: number; saetze: number }[] }) {
  const [auswahl, setAuswahl] = useState<Auswahl>(null)
  if (!kurve.length) return <p className="st-leer">Noch keine Sätze mit Wiederholungen.</p>

  // Alles über ACHSE_BIS in eine Säule.
  const saeulen = new Map<number, number>()
  for (const p of kurve) {
    const x = Math.min(p.wdh, ACHSE_BIS)
    saeulen.set(x, (saeulen.get(x) ?? 0) + p.saetze)
  }
  const gesamt = kurve.reduce((a, p) => a + p.saetze, 0)
  const hoechste = Math.max(...saeulen.values())
  const jePunkt = Math.max(1, Math.ceil(hoechste / MAX_STAPEL))

  const anteile = BEREICHE.map(b => kurve.filter(p => p.wdh >= b.von && p.wdh <= b.bis).reduce((a, p) => a + p.saetze, 0) / gesamt)
  const fuehrend = anteile.indexOf(Math.max(...anteile))
  const schnitt = kurve.reduce((a, p) => a + p.wdh * p.saetze, 0) / gesamt
  const haeufigste = kurve.reduce((a, p) => (p.saetze > a.saetze ? p : a), kurve[0]).wdh

  // ── Geometrie ───────────────────────────────────────────────────────
  const maxWdh = Math.max(12, Math.min(ACHSE_BIS, Math.max(...kurve.map(p => p.wdh))))
  const W = 320
  const links = 8
  const rechts = 8
  const feld = (W - links - rechts) / maxWdh
  const r = Math.min(4.2, feld * 0.34)
  const schritt = r * 2 + 1.6
  const stapel = Math.ceil(hoechste / jePunkt)
  const oben = 10
  const unten = 22
  const H = oben + Math.max(stapel, 6) * schritt + unten
  const x = (wdh: number) => links + feld * (wdh - 0.5)
  const boden = H - unten

  const istAktiv = (wdh: number) =>
    !auswahl || (auswahl.art === 'wdh' ? auswahl.wdh === wdh : bereichVon(wdh) === auswahl.i)

  const tippen = (neu: Auswahl) =>
    setAuswahl(a => (a && neu && a.art === neu.art && (a.art === 'wdh' ? a.wdh === (neu as { wdh: number }).wdh : a.i === (neu as { i: number }).i) ? null : neu))

  const info = (() => {
    if (!auswahl) return null
    if (auswahl.art === 'wdh') {
      const n = saeulen.get(auswahl.wdh) ?? 0
      const b = BEREICHE[bereichVon(auswahl.wdh)]
      return `${auswahl.wdh === ACHSE_BIS ? `${ACHSE_BIS}+` : auswahl.wdh} Wdh. · ${n} ${n === 1 ? 'Satz' : 'Sätze'} · ${b?.name ?? ''}`
    }
    const b = BEREICHE[auswahl.i]
    const n = Math.round(anteile[auswahl.i] * gesamt)
    const spanne = b.bis === Infinity ? `${b.von}+` : `${b.von}–${b.bis}`
    return `${b.name} (${spanne} Wdh.) · ${n} ${n === 1 ? 'Satz' : 'Sätze'} · ${Math.round(anteile[auswahl.i] * 100)} %`
  })()

  return (
    <div className="ws">
      {/* Kopf: das Wichtigste als Aussage, nicht als Zahlenzeile. */}
      <div className="ws-kopf">
        {/* Text in Tinte, die Farbe trägt das Kästchen davor. */}
        <span className="ws-titel">
          <i style={{ background: BEREICHE[fuehrend].farbe }} />
          {BEREICHE[fuehrend].name}
        </span>
        <span className="ws-unter">
          <b>{Math.round(anteile[fuehrend] * 100)} %</b> deiner Sätze · Ø {schnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Wdh. ·
          meist {haeufigste}
        </span>
      </div>

      <svg className="ws-punkte" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Jeder Satz ein Punkt, gestapelt über seiner Wiederholungszahl">
        {/* Bereichsgrenzen als feine Linien zwischen den Säulen. */}
        {BEREICHE.slice(1).map(b =>
          b.von <= maxWdh ? (
            <line key={b.name} className="ws-grenze" x1={x(b.von) - feld / 2} y1={oben - 4} x2={x(b.von) - feld / 2} y2={boden + 2} />
          ) : null,
        )}

        {[...saeulen.entries()].map(([wdh, n], spalte) => {
          const punkte = Math.ceil(n / jePunkt)
          const farbe = BEREICHE[bereichVon(wdh)].farbe
          const aktiv = istAktiv(wdh)
          return (
            <g
              key={wdh}
              className={'ws-saeule' + (aktiv ? '' : ' leise')}
              style={cssVars({ '--s': spalte })}
            >
              {Array.from({ length: punkte }, (_, k) => (
                <circle
                  key={k}
                  className="ws-punkt"
                  cx={x(wdh)}
                  cy={boden - r - k * schritt}
                  r={r}
                  fill={farbe}
                  style={cssVars({ '--k': k })}
                />
              ))}
              {/* Trefferfläche über die ganze Säule, nicht nur die Punkte. */}
              <rect
                className="ws-treffer"
                x={x(wdh) - feld / 2}
                y={oben - 6}
                width={feld}
                height={boden - oben + 6 + unten}
                onClick={() => tippen({ art: 'wdh', wdh })}
              >
                <title>{`${wdh} Wdh.: ${n} ${n === 1 ? 'Satz' : 'Sätze'}`}</title>
              </rect>
            </g>
          )
        })}

        {[1, 5, 10, 15, 20, 25].filter(v => v <= maxWdh).map(v => (
          <text key={v} className="st-achse" x={x(v)} y={H - 6} textAnchor="middle">
            {v === ACHSE_BIS ? `${v}+` : v}
          </text>
        ))}
      </svg>

      {/* Anteilsleiste: dieselben Sätze, nach Bereich zusammengefasst. */}
      <div className="ws-leiste" role="group" aria-label="Anteil der Bereiche">
        {BEREICHE.map((b, i) =>
          anteile[i] > 0 ? (
            <button
              key={b.name}
              type="button"
              className={'ws-abschnitt' + (!auswahl || (auswahl.art === 'bereich' && auswahl.i === i) || (auswahl.art === 'wdh' && bereichVon(auswahl.wdh) === i) ? '' : ' leise')}
              style={{ flexGrow: anteile[i], background: b.farbe }}
              aria-pressed={auswahl?.art === 'bereich' && auswahl.i === i}
              aria-label={`${b.name}: ${Math.round(anteile[i] * 100)} %`}
              onClick={() => tippen({ art: 'bereich', i })}
            />
          ) : null,
        )}
      </div>
      <div className="ws-legende">
        {BEREICHE.map((b, i) => (
          <button
            key={b.name}
            type="button"
            className={'ws-eintrag' + (anteile[i] === 0 ? ' leer' : '')}
            onClick={() => anteile[i] > 0 && tippen({ art: 'bereich', i })}
          >
            <i style={{ background: b.farbe }} />
            <span className="ws-eintrag-name">{b.name}</span>
            <b>{Math.round(anteile[i] * 100)} %</b>
          </button>
        ))}
      </div>

      <p className="ws-info" aria-live="polite">
        {info ?? (jePunkt > 1 ? `1 Punkt = ${jePunkt} Sätze · Antippen für Details` : 'Jeder Punkt ein Satz · Antippen für Details')}
      </p>

      <table className="st-sr">
        <caption>Sätze je Wiederholungsbereich</caption>
        <tbody>
          {BEREICHE.map((b, i) => (
            <tr key={b.name}>
              <th>{b.name}</th>
              <td>{Math.round(anteile[i] * 100)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
