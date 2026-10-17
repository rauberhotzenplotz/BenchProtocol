import type { UebungsDauerSchnitt } from '../training/calc'
import type { EinheitPunkt } from './calc'
import { ListChart } from './ListChart'
import { Saeulendiagramm } from './Diagramme'
import { anzeigeDauer } from '../training/abschluss'

/* Die drei einheitenbezogenen Auswertungen.
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

  return (
    <>
      <Saeulendiagramm
        ariaLabel="Bewegte Last je Einheit, älteste links"
        einheit="kg"
        achsenFormat={v => (v >= 1000 ? `${(v / 1000).toLocaleString('de-DE')} t` : String(v))}
        saeulen={punkte.map(p => ({
          id: p.sessionId,
          label: p.datumLabel,
          wert: p.tonnage,
          details: [`${p.tagName} · ${p.datumLabel}`, `${Math.round(p.tonnage).toLocaleString('de-DE')} kg`, `${p.erledigt}/${p.geplant} Sätze`],
        }))}
      />
      <div className="st-zahlen">
        <span>
          Ø je Einheit
          <b>{Math.round(gesamt / punkte.length).toLocaleString('de-DE')} kg</b>
        </span>
        <span>
          Höchste
          <b>{Math.round(Math.max(...punkte.map(p => p.tonnage))).toLocaleString('de-DE')} kg</b>
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
  // Vergessene Einheiten (gestartet, tagelang nicht beendet) fallen raus —
  // dieselbe 12-Stunden-Grenze wie auf dem Abschlussbildschirm. Eine
  // einzige mit 6174 min drückte in den echten Daten alle anderen Säulen
  // zu Strichen zusammen.
  const mitDauer = punkte.filter(p => p.minuten > 0 && anzeigeDauer(p.minuten) != null)
  const vergessen = punkte.filter(p => p.minuten > 0 && anzeigeDauer(p.minuten) == null).length
  if (mitDauer.length < 2) {
    return <Leer text="Ab der zweiten Einheit mit aufgezeichneter Dauer." />
  }

  const gesamt = mitDauer.reduce((a, p) => a + p.minuten, 0)

  return (
    <>
      <Saeulendiagramm
        ariaLabel="Dauer je Einheit, älteste links"
        einheit="min"
        farbe="var(--ton-b)"
        saeulen={mitDauer.map(p => ({
          id: p.sessionId,
          label: p.datumLabel,
          wert: p.minuten,
          details: [`${p.tagName} · ${p.datumLabel}`, `${p.minuten} min`, `${p.erledigt} Sätze`],
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
      {vergessen > 0 && (
        <p className="muted tiny" style={{ margin: '8px 0 0' }}>
          {vergessen === 1 ? '1 Einheit' : `${vergessen} Einheiten`} über 12 Stunden ausgeblendet — vermutlich nicht beendet.
        </p>
      )}
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
