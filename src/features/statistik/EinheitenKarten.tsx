import type { TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import type { UebungsDauerSchnitt } from '../training/calc'
import type { EinheitPunkt } from './calc'
import { tagFarbe } from '../training/dayColor'
import { ListChart } from './ListChart'
import { cssVars } from '../../lib/style'

/* Die vier einheitenbezogenen Auswertungen.
 *
 * Dort steckten sie dreifach verpackt: hinter einem Aufklapper, darin
 * eine Kachel mit nur einer Zahl, und die eigentliche Grafik erst in
 * einem Vollbild-Dialog dahinter. Wer sie sehen wollte, brauchte drei
 * Tipser und wusste vorher nicht, ob sich das lohnt.
 *
 * Hier stehen sie offen. Ein Statistik-Tab, der seine Grafiken versteckt,
 * verfehlt seinen Zweck — und der Platz ist da, weil die Seite ohnehin
 * eine Spalte ist.
 */

/** Leerzustand im Stil der übrigen Statistikkarten. */
function Leer({ text }: { text: string }) {
  return <p className="st-leer">{text}</p>
}

export function TonnageJeEinheit({ punkte }: { punkte: EinheitPunkt[] }) {
  if (punkte.length < 2) {
    return <Leer text="Ab der zweiten aufgezeichneten Einheit." />
  }

  const gesamt = punkte.reduce((a, p) => a + p.tonnage, 0)
  const erledigtGesamt = punkte.reduce((a, p) => a + p.erledigt, 0)
  const geplantGesamt = punkte.reduce((a, p) => a + p.geplant, 0)
  // Neueste Einheit oben — sie ist die, nach der man zuerst sieht.
  const neuesteZuerst = [...punkte].reverse()

  return (
    <>
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
      <div className="st-zahlen">
        <span>
          Ø je Einheit
          <b>{Math.round(gesamt / punkte.length)} kg</b>
        </span>
        <span>
          Höchste
          <b>{Math.round(Math.max(...punkte.map(p => p.tonnage)))} kg</b>
        </span>
        <span>
          Sätze abgehakt
          <b>
            {erledigtGesamt} von {geplantGesamt}
          </b>
        </span>
      </div>
    </>
  )
}

export function DauerJeEinheit({ punkte }: { punkte: EinheitPunkt[] }) {
  const mitDauer = punkte.filter(p => p.minuten > 0)
  if (mitDauer.length < 2) {
    return <Leer text="Ab der zweiten Einheit mit aufgezeichneter Dauer." />
  }

  const gesamt = mitDauer.reduce((a, p) => a + p.minuten, 0)
  const neuesteZuerst = [...mitDauer].reverse()

  return (
    <>
      <ListChart
        ariaLabel="Dauer je Einheit, neueste zuerst"
        zeilen={neuesteZuerst.map(p => ({
          id: p.sessionId,
          name: p.tagName,
          neben: `${p.datumLabel} · ${p.erledigt} Sätze`,
          wert: p.minuten,
          wertText: `${p.minuten} min`,
          farbe: p.farbe,
        }))}
      />
      <div className="st-zahlen">
        <span>
          Ø je Einheit
          <b>{Math.round(gesamt / mitDauer.length)} min</b>
        </span>
        <span>
          Längste
          <b>{Math.max(...mitDauer.map(p => p.minuten))} min</b>
        </span>
        <span>
          Kürzeste
          <b>{Math.min(...mitDauer.map(p => p.minuten))} min</b>
        </span>
      </div>
    </>
  )
}

export function DauerJeUebung({ eintraege }: { eintraege: UebungsDauerSchnitt[] }) {
  if (eintraege.length < 2) {
    return <Leer text="Sobald zwei Übungen genug abgehakte Sätze haben." />
  }

  const liste = eintraege.slice(0, 12)
  return (
    <ListChart
      ariaLabel="Durchschnittliche Dauer je Übung, längste zuerst"
      zeilen={liste.map(e => ({
        id: e.id,
        name: e.name,
        wert: e.minuten,
        wertText: `${e.minuten.toFixed(1)} min`,
        farbe: 'var(--ton-b)',
      }))}
    />
  )
}

export function LetzteEinheiten({ sessions, days }: { sessions: TrainingSession[]; days: DayWithExercises[] }) {
  // useAllSessionsForDays sortiert bereits absteigend nach Startzeit —
  // die jüngste Einheit steht dadurch oben.
  const liste = sessions.filter(s => s.status === 'completed').slice(0, 10)
  if (!liste.length) return <Leer text="Noch keine Einheit beendet." />

  return (
    <div className="st-liste">
      {liste.map((s, i) => (
        <div key={s.id} style={cssVars({ '--i': i })}>
          <i style={{ background: tagFarbe(days, s.day_id) }} />
          <span className="st-liste-name">{days.find(d => d.id === s.day_id)?.name ?? '—'}</span>
          <span className="st-liste-dat">{new Date(s.started_at).toLocaleDateString('de-DE')}</span>
          <span className="st-liste-dau">{s.minutes} min</span>
        </div>
      ))}
    </div>
  )
}
