import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { TrainingCalendar } from './TrainingCalendar'
import { tagFarbe } from './dayColor'
import { cssVars } from '../../lib/style'

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
/** Eine volle Woche, heute ganz rechts — passt ohne Scrollen in den
    Streifen. Für mehr Verlauf gibt es den Kalender-Dialog. */
const ANZAHL_TAGE = 7

function isoLokal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  plan: Plan
  days: DayWithExercises[]
  sessions: TrainingSession[]
  alleSaetze: LoggedSet[]
}

/** Kompakter Streifen der letzten 14 Tage über der Tagesliste — ein Tipp
    öffnet den vollen Monatskalender als Dialog. Pendant zu streifenAnsicht()
    + kalenderOeffnen() aus der alten App, statt eines dauerhaft
    eingebetteten Monatsrasters. */
export function DateStrip({ plan, days, sessions, alleSaetze }: Props) {
  const [offen, setOffen] = useState(false)

  const abgeschlossen = sessions.filter(s => s.status === 'completed')
  const nachTag = new Map<string, TrainingSession[]>()
  abgeschlossen.forEach(s => {
    const iso = isoLokal(new Date(s.started_at).getTime())
    const liste = nachTag.get(iso) ?? []
    liste.push(s)
    nachTag.set(iso, liste)
  })

  const heute = new Date()
  const heuteIso = isoLokal(heute.getTime())
  const zellen = Array.from({ length: ANZAHL_TAGE }, (_, idx) => {
    const i = ANZAHL_TAGE - 1 - idx
    const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - i)
    const iso = isoLokal(d.getTime())
    const eintraege = nachTag.get(iso) ?? []
    const namen = eintraege.map(s => ({
      name: days.find(day => day.id === s.day_id)?.name ?? '—',
      farbe: tagFarbe(days, s.day_id),
    }))
    return { iso, tag: d.getDate(), wochentag: WOCHENTAG[d.getDay()], namen, heute: iso === heuteIso }
  })

  const gesamt = nachTag.size
  const grenze = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - 6)
  const letzte7 = [...nachTag.keys()].filter(iso => new Date(iso) >= grenze).length

  return (
    <>
      <button className="streifen" style={cssVars({ '--i': 1 })} onClick={() => setOffen(true)} aria-label="Kalender aller Trainingstage öffnen">
        <div className="streifen-kopf">
          <b>{heute.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
          <span className="mehr">Kalender →</span>
        </div>
        <div className="dtage">
          {zellen.map(z => (
            <div
              key={z.iso}
              className={'dtag' + (z.namen.length ? ' trainiert' : '') + (z.heute ? ' heute' : '')}
              title={`${z.iso}${z.namen.length ? ' · ' + z.namen.map(n => n.name).join(', ') : ' · kein Training'}`}
            >
              <div className="wt">{z.wochentag}</div>
              <div className="nr">{z.tag}</div>
              {/* Nur Punkte statt Tagesnamen: sieben Namen nebeneinander
                  waren auf Handybreite ohnehin abgeschnitten — der Punkt
                  in der Tagesfarbe sagt dasselbe auf einen Blick, den
                  Namen liefert der Titel bzw. der Kalender-Dialog. */}
              <div className="punkte">
                {z.namen.slice(0, 3).map((n, i) => (
                  <i key={i} style={{ background: n.farbe, boxShadow: `0 0 6px ${n.farbe}` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="streifen-fuss">
          {letzte7 === 1 ? 'Eine Einheit' : `${letzte7} Einheiten`} in den letzten 7 Tagen
          {gesamt ? ` · ${gesamt} ${gesamt === 1 ? 'Trainingstag' : 'Trainingstage'} aufgezeichnet` : ''}
        </div>
      </button>

      {offen &&
        // Portal statt normalem Kind-Render — DateStrip sitzt in einer
        // <section className="view on frisch">, deren Eintrittsanimation
        // (auch nach Ablauf) einen Containing Block für position:fixed-
        // Nachfahren erzeugt. Ohne Portal würde der Dialog auf die Section
        // zusammengequetscht statt Vollbild (siehe GymMode-Fix).
        createPortal(
          <div className="overlay" onClick={e => e.target === e.currentTarget && setOffen(false)}>
            <div className="modal breit" role="dialog" aria-modal="true" aria-label="Trainingskalender">
              <TrainingCalendar plan={plan} days={days} sessions={sessions} alleSaetze={alleSaetze} />
              <div className="row end" style={{ marginTop: 14 }}>
                <button className="btn ghost sm" onClick={() => setOffen(false)}>
                  Schließen
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
