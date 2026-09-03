import { useEffect, useState } from 'react'
import type { BenchProgressionRow, BenchSlot, Plan } from '../../types/db'
import { benchLoad } from './calc'
import { blockWoche } from '../training/calc'
import { cssVars } from '../../lib/style'

/** Anteil der Bankdrück-Last je Muskel. Anatomie, keine Messung: Die
    Faktoren stehen fest und beschreiben, wie sich das Drücken auf die
    Kette verteilt. Was sich Woche für Woche ändert, ist die Intensität,
    mit der alle acht gemeinsam hochgefahren werden. */
const MUSKELN: Record<string, number> = {
  clav: 0.86, stern: 1.18, abd: 1.02, deltA: 0.95,
  deltL: 0.55, triLat: 0.74, triLong: 0.62, serr: 0.38,
}
const SCHLUESSEL = Object.keys(MUSKELN)

const LANGNAME: Record<string, string> = {
  clav: 'PM CLAVICULARIS', stern: 'PM STERNOCOSTALIS', abd: 'PM ABDOMINALIS',
  deltA: 'DELTOIDEUS ANT.', deltL: 'DELTOIDEUS LAT.', triLat: 'TRICEPS LATERALE',
  triLong: 'TRICEPS LONGUM', serr: 'SERRATUS ANT.',
}

const KURZNAME: Record<string, string> = {
  clav: 'Pec clav.', stern: 'Pec stern.', abd: 'Pec abd.', deltA: 'Delt ant.',
  deltL: 'Delt lat.', triLat: 'Tri. lat.', triLong: 'Tri. lang', serr: 'Serratus',
}

/** Ankerpunkte der Leitlinie — auf der gespiegelten Körperhälfte. */
const ANKER: Record<string, [number, number]> = {
  clav: [136, 55], stern: [138, 76], abd: [136, 93], deltA: [163, 78],
  deltL: [172, 78], triLat: [178, 138], triLong: [167, 138], serr: [150, 105],
}

/* Die folgenden Pfade stammen aus der Designstudie „Pectoralis Overdrive“
   und sind unverändert übernommen — sie sind die eigentliche Zeichnung.
   Halbe Körperkontur: Hals, Schulter, Arm bis zur Hüfte. */
const KONTUR =
  'M110 22 C102 22 97 27 93 33 C88 40 83 42 78 42 C56 47 38 59 33 79 C30 94 33 110 39 124 ' +
  'C43 146 46 172 48 200 C51 240 55 270 58 288'

/** Geschlossene Silhouette — beschneidet Flächen und Scan-Streifen auf den Körper. */
const SILHOUETTE =
  KONTUR + ' L110 292 L162 288 C165 270 169 240 172 200 C174 172 177 146 181 124 ' +
  'C187 110 190 94 187 79 C182 59 164 47 142 42 C137 42 132 40 127 33 C123 27 118 22 110 22 Z'

/** Anatomische Kanten: Klavikula, Deltopektoralrinne, freie Unterkante des
    Pectoralis, Übergang Deltaspitze zum Oberarm. Diese Linien tragen die
    Form — nicht die Umrisse der Belastungsflächen. */
const KANTEN = [
  'M104 46 C94 41 85 38 77 37 C70 40 64 45 59 52',
  'M76 42 C69 49 62 57 57 66',
  'M58 84 C61 90 68 96 78 99 C88 101 97 102 103 102',
  'M41 114 C46 117 53 117 59 113',
]

const FLAECHEN: Record<string, string> = {
  deltL: 'M78 43 C56 46 39 58 34 78 C31 90 34 104 41 115 L48 111 C42 101 40 88 43 76 C47 60 59 48 76 44 Z',
  deltA: 'M76 44 C59 48 47 60 43 76 C40 88 42 101 48 111 L58 107 C53 97 52 84 55 72 C61 58 69 47 78 44 Z',
  clav: 'M103 50 C93 46 84 43 76 42 C69 49 62 57 57 66 L103 64 Z',
  stern: 'M103 66 L56 68 C56 74 57 79 59 83 C75 84 91 85 103 86 Z',
  abd: 'M103 88 C90 87 73 86 58 83 C61 90 68 96 78 99 C88 101 97 102 103 102 Z',
  serr: 'M60 91 C65 99 72 105 82 108 L81 118 C70 115 63 108 58 98 Z',
  triLat: 'M40 113 C35 128 35 147 39 162 L49 160 C46 146 46 128 49 116 Z',
  triLong: 'M49 115 C46 129 46 146 49 160 L60 158 C58 145 58 129 60 118 Z',
}

/** Faserverlauf — zeigt die Konvergenz aller Pec-Köpfe zur Insertion am Humerus. */
const FASERN: Record<string, string> = {
  clav: 'M59 68 L101 55 M60 65 L86 44 M62 62 L74 43',
  stern: 'M57 70 L101 68 M58 76 L101 76 M60 81 L101 84',
  abd: 'M60 85 L101 90 M62 88 L98 97 M65 92 L86 99',
  serr: 'M62 97 L80 110 M61 103 L79 115',
}

const SAEULE_STUFEN = 16

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/* Die Farbreise der Studie (Cyan → Giftgrün → Hot-Pink) in den Tokens
   dieser App: --neon → --good → --magenta. Als Zahlen, weil zwischen den
   Stufen gemischt wird und CSS das für beliebige Anteile nicht kann. */
const TUERKIS: [number, number, number] = [53, 240, 208]
const GRUEN: [number, number, number] = [63, 224, 138]
const PINK: [number, number, number] = [255, 77, 157]

function mischen(a: [number, number, number], b: [number, number, number], t: number): string {
  const k = clamp(t, 0, 1)
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`
}

/** 0 → türkis, 0,62 → grün, 1 → pink. */
function hitzeFarbe(i: number): string {
  if (i >= 1) return `rgb(${PINK.join(',')})`
  if (i >= 0.62) return mischen(GRUEN, PINK, (i - 0.62) / 0.38)
  return mischen(TUERKIS, GRUEN, i / 0.62)
}

interface Ton {
  roh: number
  farbe: string
  fuellung: number
  kante: number
  faser: number
}

function toeneBerechnen(intensitaet: number): { map: Record<string, Ton>; spitze: string } {
  const map: Record<string, Ton> = {}
  let spitze = SCHLUESSEL[0]
  let hoechster = -1
  for (const key of SCHLUESSEL) {
    const i = clamp(intensitaet * MUSKELN[key], 0, 1.2)
    if (i > hoechster) { hoechster = i; spitze = key }
    const sichtbar = Math.min(i, 1)
    map[key] = {
      roh: i,
      farbe: hitzeFarbe(i),
      fuellung: 0.08 + sichtbar * 0.52,
      kante: 0.15 + sichtbar * 0.5,
      faser: 0.18 + sichtbar * 0.42,
    }
  }
  // Der heißeste Bereich bekommt eine kräftigere Kante statt eines eigenen Pulses.
  map[spitze].kante = Math.min(1, map[spitze].kante + 0.4)
  return { map, spitze }
}

/** Belastungsflächen: reine Füllung, bewusst ohne eigene helle Kontur —
    genau die ließ die Segmente in der Studie wie Panzerplatten wirken. Die
    Form kommt aus der Strichzeichnung darüber. */
function Flaechen({ toene, gespiegelt }: { toene: Record<string, Ton>; gespiegelt?: boolean }) {
  return (
    <g transform={gespiegelt ? 'translate(220,0) scale(-1,1)' : undefined}>
      {SCHLUESSEL.map(key => {
        const t = toene[key]
        return (
          <path
            key={key}
            className="bk-flaeche"
            d={FLAECHEN[key]}
            fill={t.farbe}
            fillOpacity={t.fuellung}
            stroke={t.farbe}
            strokeOpacity={t.kante}
            strokeWidth={1.2}
          />
        )
      })}
    </g>
  )
}

/** Strichzeichnung über den Flächen: Kontur, Anatomiekanten, Faserverlauf. */
function Striche({ toene, gespiegelt }: { toene: Record<string, Ton>; gespiegelt?: boolean }) {
  return (
    <g transform={gespiegelt ? 'translate(220,0) scale(-1,1)' : undefined}>
      <path d={KONTUR} fill="none" stroke="var(--neon)" strokeOpacity={0.34} strokeWidth={1} />
      {KANTEN.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--neon)" strokeOpacity={0.72} strokeWidth={1} strokeLinecap="round" />
      ))}
      {Object.keys(FASERN).map(key => (
        <path
          key={key}
          className="bk-flaeche"
          d={FASERN[key]}
          fill="none"
          strokeWidth={0.6}
          strokeLinecap="round"
          stroke={toene[key].farbe}
          strokeOpacity={toene[key].faser}
        />
      ))}
      <path
        d="M62 152 L104 148 M65 170 L104 167 M68 188 L104 186"
        fill="none"
        stroke="var(--neon)"
        strokeOpacity={0.17}
        strokeWidth={0.75}
      />
    </g>
  )
}

/** Übernommen aus der Designstudie „Pectoralis Overdrive“ (siehe
    BenchCockpit.jsx), auf die Optik und die Daten dieser App gebracht.

    Was der Torso zeigt: die Intensität der laufenden Woche, also den
    Anteil vom geschätzten 1RM, den das Programm diese Woche vorsieht
    (bench_progression.pct). Genau diese Zahl steht sonst nur als Gewicht
    da — hier sieht man auf einen Blick, ob es eine leichte, eine schwere
    oder eine Deload-Woche ist, und welcher Teil der Drückkette sie trägt.

    Die Aufteilung auf die acht Segmente ist Anatomie, keine Messung: Die
    Faktoren stehen fest, gemeinsam hochgefahren wird über die Intensität.
    Deshalb steht am Fuß "Anteil an der Last" und nicht etwa "gemessen".

    Ohne Fremdbibliothek: Die Studie nutzt Framer Motion, hier reichen
    CSS-Übergänge auf fill/stroke und zwei Keyframes — beides bei
    prefers-reduced-motion abgeschaltet. */
export function LastVerteilung({ plan, zeilen }: { plan: Plan; zeilen: Record<BenchSlot, BenchProgressionRow[]> }) {
  const [slot, setSlot] = useState<BenchSlot>('d1')

  const zeile = zeilen[slot].find(r => r.week === blockWoche(plan.week))
  const intensitaet = zeile?.pct ?? 0
  const gewicht = zeile ? benchLoad(plan, zeile) : 0
  const { map, spitze } = toeneBerechnen(intensitaet)

  // Die Leitlinie wandert im Diagnose-Takt durch die acht Segmente. Ohne
  // Bewegung zeigt sie fest auf den heißesten — dann gibt es keinen Takt,
  // an dem sie sich orientieren könnte.
  const [takt, setTakt] = useState(0)
  const ruhig = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (ruhig) return
    const id = setInterval(() => setTakt(v => v + 1), 2800)
    return () => clearInterval(id)
  }, [ruhig])

  const gezeigt = ruhig ? spitze : SCHLUESSEL[takt % SCHLUESSEL.length]
  const anker = ANKER[gezeigt]
  const gezeigtProzent = Math.round(clamp(intensitaet * MUSKELN[gezeigt], 0, 1.2) * 100)
  const saeuleAn = Math.round(clamp(intensitaet, 0, 1) * SAEULE_STUFEN)

  return (
    <div className="card bk-karte" style={cssVars({ '--i': 3 })}>
      <h3>
        <span className="tick" />
        Lastverteilung
        <span className="bk-kopfwert">{Math.round(intensitaet * 100)} % vom 1RM</span>
      </h3>

      <div className="bk-schalter" role="group" aria-label="Bankdrücken-Variante">
        {(['d1', 'd3'] as const).map(s => (
          <button
            key={s}
            type="button"
            className={'chip' + (slot === s ? ' neon' : ' mute')}
            aria-pressed={slot === s}
            onClick={() => setSlot(s)}
          >
            {s === 'd1' ? 'Schwer' : 'Mit Pause'}
          </button>
        ))}
        <span className="spacer" />
        <span className="mono tiny bk-last">
          {gewicht ? `${gewicht} kg` : '—'}
          {zeile?.scheme ? ` · ${zeile.scheme}` : ''}
        </span>
      </div>

      {!zeile ? (
        <p className="muted tiny" style={{ margin: '10px 0 0' }}>
          Für diese Woche liegt keine Vorgabe vor.
        </p>
      ) : (
        <>
          <div className="bk-buehne">
            {/* Ausschnitt auf den Oberkörper — der Bauchraum trägt keine Daten. */}
            <svg viewBox="0 12 220 196" aria-hidden="true" className="bk-torso">
              <defs>
                <linearGradient id="bk-scan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--neon)" stopOpacity={0} />
                  <stop offset="50%" stopColor="var(--neon)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
                </linearGradient>
                {/* Die Flächen leuchten, statt sich hart abzugrenzen. */}
                <filter id="bk-weich" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="bloom" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="soft" />
                  <feMerge>
                    <feMergeNode in="bloom" />
                    <feMergeNode in="soft" />
                  </feMerge>
                </filter>
                <clipPath id="bk-clip">
                  <path d={SILHOUETTE} />
                </clipPath>
              </defs>

              <g clipPath="url(#bk-clip)">
                <rect className="bk-scanband" x="18" y="-46" width="184" height="46" fill="url(#bk-scan)" />
                <g filter="url(#bk-weich)">
                  <Flaechen toene={map} />
                  <Flaechen toene={map} gespiegelt />
                </g>
                <Striche toene={map} />
                <Striche toene={map} gespiegelt />
              </g>

              <path d="M110 34 L110 200" fill="none" stroke="var(--neon)" strokeOpacity={0.34} strokeWidth={1} />
              <path d="M46 116 Q110 140 174 116" fill="none" stroke="var(--neon)" strokeOpacity={0.17} strokeWidth={0.75} />

              <g className="bk-fadenkreuz">
                <circle cx="110" cy="80" r="52" fill="none" strokeWidth={1} strokeDasharray="5 11" stroke="var(--neon)" strokeOpacity={0.5} />
              </g>
              <g fill="none" strokeWidth={1} stroke="var(--neon)" strokeOpacity={0.5}>
                <path d="M110 22 v8 M110 140 v-8 M52 80 h8 M168 80 h-8" />
                <rect x="86" y="56" width="48" height="48" strokeDasharray="10 38" />
              </g>

              {/* Leitlinie auf das gerade abgetastete Segment */}
              <g className="bk-leitlinie">
                <text x="214" y="22" textAnchor="end" fill="var(--neon)" className="bk-leittext">
                  {LANGNAME[gezeigt]} {gezeigtProzent}%
                </text>
                <path
                  fill="none"
                  stroke="var(--neon)"
                  strokeOpacity={0.65}
                  strokeWidth={0.8}
                  d={`M214 27 L214 34 L${anker[0]} 34 L${anker[0]} ${anker[1]}`}
                />
                <circle r="1.9" fill="var(--neon)" cx={anker[0]} cy={anker[1]} />
              </g>
            </svg>

            <div className="bk-saeule" aria-hidden="true">
              {Array.from({ length: SAEULE_STUFEN }, (_, i) => {
                const an = i < saeuleAn
                const heiss = an && i >= SAEULE_STUFEN - 3
                return <i key={i} className={'bk-stufe' + (an ? ' an' : '') + (heiss ? ' heiss' : '')} />
              })}
            </div>
          </div>

          <div className="bk-fuss">
            {SCHLUESSEL.map(key => {
              const t = map[key]
              return (
                <div key={key} className="bk-zelle">
                  <span className="bk-zelle-name">{KURZNAME[key]}</span>
                  <span className="bk-zelle-wert" style={{ color: t.farbe }}>
                    {Math.round(t.roh * 100)} <small>%</small>
                  </span>
                  <span className="bk-zelle-balken">
                    <i style={{ width: `${Math.round(clamp(t.roh, 0, 1) * 100)}%`, background: t.farbe }} />
                  </span>
                </div>
              )
            })}
          </div>

          <p className="muted tiny bk-hinweis">
            Anteil an der Last, nicht gemessen: Die Aufteilung auf die Muskeln steht fest, hochgefahren wird sie
            über die Intensität der Woche.
          </p>
        </>
      )}
    </div>
  )
}
