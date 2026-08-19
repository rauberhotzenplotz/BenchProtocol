import { useState } from 'react'
import type { EinheitPunkt } from './calc'
import { sternbild } from './sternbild'
import { KachelKarte } from './KachelKarte'

const W = 660
const H = 190
const P = { t: 26, r: 26, b: 26, l: 26 }

/** Dein Block als Sternbild: jede aufgezeichnete Einheit ein Stern,
    aufeinanderfolgende Einheiten mit einer feinen Linie verbunden.

    Bewusst ohne Achsen und Gitter. Zum genauen Ablesen von Tonnage und
    Dauer stehen darüber zwei Balkendiagramme; diese Karte beantwortet
    eine andere Frage — ob der Rhythmus stimmt. Achsen würden zum
    Millimeterlesen einladen, wozu die Darstellung nicht gedacht ist. Die
    Zahlen gibt es beim Überfahren, gleiche Bauart wie beim Balkenchart.

    Einfarbig statt nach Trainingstag eingefärbt: das Sternbild ist eine
    Figur, kein Vergleich zwischen Tagen. Mehrere Farben zerlegten es
    optisch wieder in Einzelteile. */
export function SternbildCard({ punkte, gross = false }: { punkte: EinheitPunkt[]; gross?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const sterne = sternbild(punkte)

  if (sterne.length < 2) {
    return gross ? (
      <div className="card sternbild-gross leer">
        <h3>Sternbild des Blocks</h3>
        <p className="muted tiny" style={{ margin: 0 }}>
          Ab der zweiten aufgezeichneten Einheit entsteht hier deine Figur.
        </p>
      </div>
    ) : (
      <KachelKarte titel="Sternbild des Blocks" wert="—" hinweis="ab zwei Einheiten" />
    )
  }

  const iw = W - P.l - P.r
  const ih = H - P.t - P.b
  const X = (x: number) => P.l + x * iw
  const Y = (y: number) => P.t + y * ih
  const R = (g: number) => 2.2 + g * 3.2

  const linie = sterne.map(s => `${X(s.x).toFixed(1)},${Y(s.y).toFixed(1)}`).join(' ')
  const staerkster = sterne.reduce((a, s, i) => (s.punkt.tonnage > sterne[a].punkt.tonnage ? i : a), 0)

  const inhalt = (
    <>
      <div className="chartwrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          className="chart sternbild"
          role="img"
          aria-label={`Sternbild aus ${sterne.length} Einheiten, verbunden in zeitlicher Reihenfolge`}
        >
          {/* pathLength normiert die Länge auf 1 — das Stylesheet kann
              die Linie dadurch mit stroke-dasharray: 1 zeichnen, ohne
              die tatsächliche Länge zu kennen. */}
          <polyline className="sb-linie" points={linie} pathLength={1} />
          {sterne.map((s, i) => (
            <g key={s.punkt.sessionId} style={{ animationDelay: `${i * 90}ms` }} className="sb-stern">
              {i === staerkster && <circle className="sb-krone" cx={X(s.x)} cy={Y(s.y)} r={R(s.groesse) + 5.5} />}
              <circle className="sb-hof" cx={X(s.x)} cy={Y(s.y)} r={R(s.groesse) + 3} />
              <circle className="sb-kern" cx={X(s.x)} cy={Y(s.y)} r={R(s.groesse)} />
            </g>
          ))}
          {/* Trefferflächen zuletzt und großzügiger als die Sterne — auf
              dem Handy ist ein 5-px-Punkt sonst nicht zu treffen. */}
          {sterne.map((s, i) => (
            <circle
              key={s.punkt.sessionId}
              className="sb-treffer"
              cx={X(s.x)}
              cy={Y(s.y)}
              r={16}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover != null && (
          <div
            className="ctip on"
            style={{ left: `${(X(sterne[hover].x) / W) * 100}%`, top: `${(Y(sterne[hover].y) / H) * 100}%` }}
          >
            <b>{sterne[hover].punkt.tagName}</b>
            <s>
              {sterne[hover].punkt.datumLabel} · {sterne[hover].punkt.wochenLabel}
            </s>
            <i>
              {Math.round(sterne[hover].punkt.tonnage)} kg · {sterne[hover].punkt.erledigt} Sätze ·{' '}
              {sterne[hover].punkt.minuten} min
            </i>
          </div>
        )}
      </div>
      <div className="sb-fuss">
        <span>{sterne[0].punkt.datumLabel}</span>
        <span className="sb-hinweis">{sterne.length} Einheiten · Abstand zeigt die Pausen</span>
        <span>{sterne[sterne.length - 1].punkt.datumLabel}</span>
      </div>
    </>
  )

  // Groß steht die Figur offen auf der Übersicht — sie ist das Schaustück
  // der Seite und wäre hinter einem Tipp verschenkt. Klein bleibt sie eine
  // Kachel unter den übrigen Auswertungen.
  if (gross) {
    return (
      <div className="card sternbild-gross">
        <h3>
          <span className="tick" />
          Sternbild des Blocks
        </h3>
        {inhalt}
      </div>
    )
  }

  return (
    <KachelKarte titel="Sternbild des Blocks" wert={sterne.length} einheit="Einheiten" hinweis="Abstand zeigt die Pausen">
      {inhalt}
    </KachelKarte>
  )
}
