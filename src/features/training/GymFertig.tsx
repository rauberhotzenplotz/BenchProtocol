import { useEffect, useState } from 'react'
import { CountUp } from '../../components/CountUp'
import { cssVars } from '../../lib/style'
import { vibrieren, TRAINING_FERTIG } from '../../lib/haptik'
import { dauerStunden } from './abschluss'

/** Abschlusstitel unter dem Stern. Früher standen sie als Paar mit einer
    Unterzeile da; seit der Bildschirm Werte und Übungsliste trägt, bleibt
    nur der Titel — die Unterzeile hätte die Liste unter den Rand geschoben. */
const LOB = [
  'Stark durchgezogen',
  'Das sitzt',
  'Wieder eine im Kasten',
  'Nichts liegen gelassen',
  'Da war Druck dahinter',
  'Abgehakt und verdient',
  'Genau so geht das',
  'Ein Stück stärker',
  'Solide Arbeit',
  'Durchgezogen wie geplant',
  'Das zahlt sich aus',
  'Einheit steht',
  'Sauber gearbeitet',
  'Erledigt',
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

/** Fünfzackiger Stern im 100er-Raster, Spitze oben. */
const STERN = '50,5 62,37 96,38 69,59 79,92 50,73 21,92 31,59 4,38 38,37'

export interface AbschlussUebung {
  id: string
  name: string
  /** Zweite Zeile neben der Satzzahl, etwa die Muskelgruppe. */
  meta: string | null
  saetze: number
  /** Sätze, die den Satz an derselben Position beim letzten Mal
      übertroffen haben (siehe abschluss.ts). */
  plus: number
}

interface Props {
  /** Name des Trainingstags, steht oben wie ein Seitentitel. */
  titel: string
  uebungen: AbschlussUebung[]
  /** null, solange die Gesamtzahl der Einheiten noch nicht geladen ist —
      dann steht ein Strich statt einer falschen Zahl. */
  workoutNummer: number | null
  dauerMinuten: number | null
  serieWochen: number | null
  /** Texte der in dieser Einheit erzielten Bestleistungen (siehe rekord.ts),
      in der Reihenfolge, in der sie erzielt wurden. Leer, wenn keine. */
  rekorde: string[]
  onPruefen: () => void
  onBeenden: () => void
}

/** Abschluss einer Einheit, aufgebaut wie man es aus Alpha Progression
    kennt: oben ein Stern, darunter drei Kennzahlen, dann jede Übung mit
    ihren Sätzen und den Steigerungen gegenüber dem letzten Mal.

    Die Zahl im Stern sind die gesteigerten Sätze der ganzen Einheit — die
    Summe der grünen Pfeile in der Liste darunter. Ohne eine Steigerung
    steht dort der Haken, damit eine Einheit auf Erhaltungsniveau nicht mit
    einer Null abgestraft wird. */
export function GymFertig({ titel, uebungen, workoutNummer, dauerMinuten, serieWochen, rekorde, onPruefen, onBeenden }: Props) {
  // Einmal beim Aufbau würfeln, nicht bei jedem Rendern — sonst wechselte
  // der Text unter den Augen des Nutzers.
  const [lob] = useState(() => LOB[Math.floor(Math.random() * LOB.length)])
  const plusGesamt = uebungen.reduce((a, u) => a + u.plus, 0)

  // Der Abschluss ist die Stelle, an der man das Handy typischerweise gar
  // nicht in der Hand hat — hier lohnt sich das spürbare Signal am meisten.
  useEffect(() => {
    vibrieren(TRAINING_FERTIG)
  }, [])

  return (
    <>
      <div className="gym-fertig abschluss">
        <div className="abs-kopf">{titel}</div>

        <div className="abs-stern">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <polygon className="abs-stern-form" points={STERN} />
            {plusGesamt === 0 && <path className="abs-stern-haken" d="M34 52 L45 63 L66 40" />}
          </svg>
          {plusGesamt > 0 && (
            <b className="abs-stern-zahl" aria-label={`${plusGesamt} gesteigerte Sätze`}>
              <CountUp value={plusGesamt} duration={900} />
            </b>
          )}
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

        <div className="gym-ftitel">{lob}</div>

        <div className="abs-werte">
          <div className="abs-wert">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="9" r="6" />
              <path d="M8.5 14 7 21l5-2.5 5 2.5-1.5-7M12 6.5v5" />
            </svg>
            <b>{workoutNummer != null ? `${workoutNummer}.` : '—'}</b>
            <span>Workout</span>
          </div>
          <div className="abs-wert">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
            </svg>
            <b>{dauerMinuten != null ? dauerStunden(dauerMinuten) : '—'}</b>
            <span>Std.</span>
          </div>
          <div className="abs-wert">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21c-4 0-7-2.7-7-6.5 0-3.6 3-5.6 4-9.5 2 1.5 3 3.5 3 5.5 1-1 1.6-2 1.8-3.5C16.6 9 19 11.5 19 14.5 19 18.3 16 21 12 21Z" />
            </svg>
            <b>{serieWochen != null ? `${serieWochen}W` : '—'}</b>
            <span>am Stück</span>
          </div>
        </div>

        {rekorde.length > 0 && (
          <div className="gym-frekorde">
            <span className="gym-frekord-label">{rekorde.length === 1 ? 'Neue Bestleistung' : 'Neue Bestleistungen'}</span>
            {rekorde.map((r, i) => (
              <div key={i} className="gym-frekord-zeile">
                {r}
              </div>
            ))}
          </div>
        )}

        {uebungen.length > 0 && (
          <>
            <div className="abs-liste-kopf">
              {uebungen.length} {uebungen.length === 1 ? 'Übung' : 'Übungen'}
            </div>
            <div className="abs-liste">
              {uebungen.map((u, i) => (
                <div key={u.id} className="abs-zeile">
                  <span className="abs-nr">{i + 1}</span>
                  <div className="abs-text">
                    <div className="abs-name">{u.name}</div>
                    <div className="abs-meta">
                      {u.saetze} {u.saetze === 1 ? 'Satz' : 'Sätze'}
                      {u.plus > 0 && (
                        <span className="abs-plus" aria-label={`${u.plus} gesteigert`}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20V5M6 11l6-6 6 6" />
                          </svg>
                          {u.plus}
                        </span>
                      )}
                      {u.meta && <span className="abs-muskel">{u.meta}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="gym-tasten zwei spaet">
        <button className="gym-taste grau" onClick={onPruefen}>
          Sätze prüfen
        </button>
        <button className="gym-taste ok" onClick={onBeenden}>
          Training beenden
        </button>
      </div>
    </>
  )
}
