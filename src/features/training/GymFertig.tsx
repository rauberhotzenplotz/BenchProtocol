import { useState } from 'react'
import { CountUp } from '../../components/CountUp'
import { cssVars } from '../../lib/style'

/** Abschlusstexte als Paare, nicht als zwei getrennte Töpfe: Überschrift
    und Unterzeile sollen zueinander passen, statt zufällig zu einer
    schiefen Kombination zu geraten. */
const LOB = [
  { titel: 'Stark durchgezogen', zeile: 'Genau solche Einheiten summieren sich.' },
  { titel: 'Das sitzt', zeile: 'Sauber abgeliefert, Satz für Satz.' },
  { titel: 'Wieder eine im Kasten', zeile: 'Der Block wächst mit jeder davon.' },
  { titel: 'Nichts liegen gelassen', zeile: 'Du hast heute alles mitgenommen.' },
  { titel: 'Da war Druck dahinter', zeile: 'So sieht ernsthafte Arbeit aus.' },
  { titel: 'Abgehakt und verdient', zeile: 'Jetzt übernimmt die Erholung.' },
  { titel: 'Genau so geht das', zeile: 'Ruhig, planmäßig, konsequent.' },
  { titel: 'Ein Stück stärker', zeile: 'Fortschritt entsteht aus Wiederholung.' },
  { titel: 'Solide Arbeit', zeile: 'Kein Satz geschenkt heute.' },
  { titel: 'Durchgezogen wie geplant', zeile: 'Auf so eine Einheit lässt sich bauen.' },
  { titel: 'Das zahlt sich aus', zeile: 'Nicht heute — aber in ein paar Wochen.' },
  { titel: 'Einheit steht', zeile: 'Wieder ein Haken mehr in diesem Block.' },
  { titel: 'Sauber gearbeitet', zeile: 'Technik und Einsatz haben gestimmt.' },
  { titel: 'Erledigt', zeile: 'Den Rest macht jetzt der Schlaf.' },
]

const FUNKEN = [
  { winkel: -90, weite: 104, spaet: 480 },
  { winkel: -42, weite: 126, spaet: 530 },
  { winkel: 8, weite: 98, spaet: 500 },
  { winkel: 48, weite: 132, spaet: 560 },
  { winkel: 96, weite: 106, spaet: 510 },
  { winkel: 142, weite: 122, spaet: 570 },
  { winkel: -168, weite: 112, spaet: 490 },
  { winkel: -128, weite: 134, spaet: 545 },
  { winkel: 178, weite: 96, spaet: 520 },
]

interface Props {
  geplant: number
  erledigt: number
  tonnage: number
  onWeiter: () => void
  onBeenden: () => void
}

export function GymFertig({ geplant, erledigt, tonnage, onWeiter, onBeenden }: Props) {
  // Einmal beim Aufbau würfeln, nicht bei jedem Rendern — sonst wechselte
  // der Text unter den Augen des Nutzers.
  const [lob] = useState(() => LOB[Math.floor(Math.random() * LOB.length)])

  return (
    <>
      <div className="gym-fertig">
        <div className="gym-fhaken">
          <svg viewBox="0 0 100 100">
            <circle className="ring" cx="50" cy="50" r="46" />
            <path className="haken" d="M30 51 L44 65 L71 34" />
          </svg>
          {FUNKEN.map((f, i) => {
            const rad = (f.winkel * Math.PI) / 180
            return (
              <span
                key={i}
                className="gym-ffunke"
                style={cssVars({
                  '--fx': `${(Math.cos(rad) * f.weite).toFixed(1)}px`,
                  '--fy': `${(Math.sin(rad) * f.weite).toFixed(1)}px`,
                  animationDelay: `${f.spaet}ms`,
                })}
              />
            )
          })}
        </div>

        <div className="gym-ftitel">{lob.titel}</div>
        <div className="gym-fzeile">{lob.zeile}</div>

        <div className="gym-fwerte">
          <div className="gym-fwert">
            <b>
              <CountUp value={erledigt} duration={1200} />
            </b>
            <span>von {geplant} Sätzen</span>
          </div>
          <div className="gym-fwert">
            <b>
              <CountUp value={Math.round(tonnage)} duration={1200} />
            </b>
            <span>kg bewegt</span>
          </div>
        </div>
      </div>

      <div className="gym-tasten zwei spaet">
        <button className="gym-taste grau" onClick={onWeiter}>
          Weiter im Training
        </button>
        <button className="gym-taste ok" onClick={onBeenden}>
          Training beenden
        </button>
      </div>
    </>
  )
}
