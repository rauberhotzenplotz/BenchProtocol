import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSchliessenPerZurueck } from '../lib/backClose'

interface ZahlRadProps {
  offen: boolean
  titel: string
  werte?: number[]
  aktuell: number | null
  format: (n: number) => string
  /** Erste Zeile "—" zum Leeren des Werts — für Felder, die auch unausgefüllt sein dürfen. */
  leerOption?: boolean
  /** Einheit hinter der Zahl im Numpad-Display, z. B. "kg" oder "min". */
  einheit?: string
  /** Nur das Numpad, ohne die scrollbare Werteliste darüber — für Felder
      ohne sinnvolle Werteauswahl (z. B. Zielgewicht, Testsatz), bei denen
      jeder Wert gleich plausibel ist und ein Rad nur Platz kosten würde. */
  nurNumpad?: boolean
  onWahl: (n: number | null) => void
  onSchliessen: () => void
}

const TASTEN = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫']

/** Tastatureingabe für Zahlen ersetzt durch eine antippbare Liste — kein
    Zahlenfeld, in das man sich vertippen kann. Darunter, immer sichtbar
    (kein Umschalter, kein zweiter Tab), ein Numpad für Werte außerhalb der
    Listenschritte (z. B. 83,7 kg). Als Bottom-Sheet mit eigenem
    Scrollbereich für die Liste, damit auch lange Listen (Gewicht in
    2,5-kg-Schritten bis 300 kg) bequem erreichbar bleiben. */
export function ZahlRad({ offen, titel, werte, aktuell, format, leerOption, einheit, nurNumpad, onWahl, onSchliessen }: ZahlRadProps) {
  const listeRef = useRef<HTMLDivElement>(null)
  const [eingabe, setEingabe] = useState('')

  useSchliessenPerZurueck(offen, onSchliessen)

  useEffect(() => {
    if (!offen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [offen, onSchliessen])

  // Bei jedem Öffnen frisch anfangen: sonst bliebe ein angefangener
  // Zahlentext vom letzten Mal stehen — ZahlRad bleibt über "offen" nur
  // aus- statt abgehängt, das Öffnen ist kein echtes Neu-Mounten.
  // Abgeleiteter Zustand beim Rendern statt Effekt (dasselbe Muster wie
  // sonst in der App), damit der Reset im selben Durchlauf steht, in dem
  // "offen" auf true kippt.
  const [warOffen, setWarOffen] = useState(offen)
  if (offen !== warOffen) {
    setWarOffen(offen)
    // Bewusst leer statt mit dem bisherigen Wert vorbelegt: Wer eine Zahl
    // ändern will, musste sonst erst die alte Ziffer für Ziffer
    // wegräumen. Der bisherige Wert steht stattdessen grau als
    // Platzhalter da (siehe zahltast-anzeige unten) und bleibt erhalten,
    // solange nichts Neues getippt wird.
    if (offen) setEingabe('')
  }

  useEffect(() => {
    if (!offen || nurNumpad) return
    const liste = listeRef.current
    if (!liste) return
    const aktiv = liste.querySelector<HTMLElement>('[data-an="true"]')
    aktiv?.scrollIntoView({ block: 'center' })
  }, [offen, nurNumpad])

  if (!offen) return null

  const taste = (t: string) => {
    if (t === '⌫') { setEingabe(s => s.slice(0, -1)); return }
    if (t === ',') { setEingabe(s => (s.includes(',') ? s : s + ',')); return }
    setEingabe(s => s + t)
  }

  const geparst = eingabe.trim() === '' ? null : parseFloat(eingabe.replace(',', '.'))
  const gueltig = geparst != null && !isNaN(geparst)

  const uebernehmen = () => {
    if (!gueltig || geparst == null) return
    onWahl(Math.round(geparst * 100) / 100)
    onSchliessen()
  }

  return createPortal(
    <div className="zahlrad-overlay" onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div className="zahlrad" role="dialog" aria-modal="true" aria-label={titel}>
        <span className="zahlrad-griff" aria-hidden="true" />
        <div className="zahlrad-kopf">
          <span>{titel}</span>
          <button type="button" className="zahlrad-schliessen" onClick={onSchliessen} aria-label="Schließen">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {!nurNumpad && (
          <div className="zahlrad-liste" ref={listeRef}>
            {leerOption && (
              <button
                type="button"
                className={'zahlrad-wert' + (aktuell == null ? ' an' : '')}
                data-an={aktuell == null}
                onClick={() => {
                  onWahl(null)
                  onSchliessen()
                }}
              >
                —
              </button>
            )}
            {(werte ?? []).map(w => (
              <button
                key={w}
                type="button"
                className={'zahlrad-wert' + (w === aktuell ? ' an' : '')}
                data-an={w === aktuell}
                onClick={() => {
                  onWahl(w)
                  onSchliessen()
                }}
              >
                {format(w)}
              </button>
            ))}
          </div>
        )}

        <div className={'zahltast' + (nurNumpad ? ' voll' : '')}>
          <div className="zahltast-anzeige">
            {eingabe === '' ? (
              <span className="zahltast-platzhalter">{aktuell != null ? format(aktuell) : '0'}</span>
            ) : (
              eingabe
            )}
            {einheit && <em>{einheit}</em>}
          </div>
          <div className="zahltast-grid">
            {TASTEN.map(t => (
              <button
                key={t}
                type="button"
                className={'zahltast-taste' + (t === '⌫' ? ' loeschen' : '')}
                onClick={() => taste(t)}
                aria-label={t === '⌫' ? 'Letzte Ziffer löschen' : t === ',' ? 'Komma' : t}
              >
                {t}
              </button>
            ))}
          </div>
          <button type="button" className="zahltast-uebernehmen" disabled={!gueltig} onClick={uebernehmen}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface ZahlEingabeProps {
  wert: number | null
  werte?: number[]
  format?: (n: number) => string
  titel: string
  leerOption?: boolean
  einheit?: string
  nurNumpad?: boolean
  platzhalter?: string
  className?: string
  onWahl: (n: number | null) => void
}

/** Antippbarer Auslöser fürs ZahlRad — Drop-in-Ersatz für ein Zahlenfeld
    (gleiche ".inp"-Optik), öffnet beim Antippen die Auswahlliste statt
    die Tastatur. */
export function ZahlEingabe({ wert, werte, format = String, titel, leerOption, einheit, nurNumpad, platzhalter = '—', className, onWahl }: ZahlEingabeProps) {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={'inp zahleingabe' + (className ? ' ' + className : '')}
        onClick={() => setOffen(true)}
      >
        {wert != null ? format(wert) : platzhalter}
      </button>
      <ZahlRad
        offen={offen}
        titel={titel}
        werte={werte}
        aktuell={wert}
        format={format}
        leerOption={leerOption}
        einheit={einheit}
        nurNumpad={nurNumpad}
        onWahl={onWahl}
        onSchliessen={() => setOffen(false)}
      />
    </>
  )
}
