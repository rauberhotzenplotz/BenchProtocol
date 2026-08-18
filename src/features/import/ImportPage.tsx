import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseWorkbook, type ParsedWorkbook } from './xlsxParse'
import { baueImportZeilen } from './importPlan'
import { parseAlphaCsv, type CsvWorkout } from './csvParse'
import { planCsvImport, type CsvImportPlan } from './importCsv'
import { useImportPlan, useImportCsvSets } from './queries'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays } from '../training/queries'
import type { PlanTyp } from '../../types/db'
import { cssVars } from '../../lib/style'

function fehlertext(err: unknown, fallback: string): string {
  return err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message ? err.message : fallback
}

export function ImportPage() {
  const navigate = useNavigate()
  const { activePlan, setActivePlanId } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const importPlan = useImportPlan()
  const importCsvSets = useImportCsvSets()

  const [datei, setDatei] = useState<File | null>(null)
  const [geparst, setGeparst] = useState<ParsedWorkbook | null>(null)
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<PlanTyp>('general')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  const [csvDatei, setCsvDatei] = useState<File | null>(null)
  const [csvWorkouts, setCsvWorkouts] = useState<CsvWorkout[] | null>(null)
  const [csvPlan, setCsvPlan] = useState<CsvImportPlan | null>(null)
  const [csvFehler, setCsvFehler] = useState<string | null>(null)
  const [csvLaedt, setCsvLaedt] = useState(false)
  const [csvErfolg, setCsvErfolg] = useState<number | null>(null)

  const dateiGewaehlt = async (f: File) => {
    setFehler(null)
    setDatei(f)
    setGeparst(null)
    setLaedt(true)
    try {
      const ergebnis = await parseWorkbook(f)
      setGeparst(ergebnis)
      setName(f.name.replace(/\.xlsx?$/i, '').replace(/[_-]+/g, ' ').trim() || 'Neuer Plan')
      setTyp(ergebnis.bench ? 'bench' : 'general')
    } catch (err) {
      setFehler(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Datei konnte nicht gelesen werden.')
    } finally {
      setLaedt(false)
    }
  }

  const einlesen = () => {
    if (!geparst || !name.trim()) return
    setFehler(null)
    // Alle Zeilen samt IDs entstehen hier, ohne Netz; geschrieben wird über
    // die Warteschlange. Der Plan ist dadurch sofort benutzbar — auch offline.
    const daten = baueImportZeilen(geparst, name.trim(), typ)
    importPlan.mutate(daten)
    setActivePlanId(daten.plan.id)
    navigate('/training')
  }

  const gesamtUebungen = geparst?.days.reduce((a, d) => a + d.exercises.length, 0) ?? 0

  const csvDateiGewaehlt = async (f: File) => {
    setCsvFehler(null)
    setCsvErfolg(null)
    setCsvDatei(f)
    setCsvWorkouts(null)
    setCsvPlan(null)
    setCsvLaedt(true)
    try {
      const workouts = parseAlphaCsv(await f.text())
      if (!workouts.length) throw new Error('In der CSV stehen keine Einheiten. Erwartet wird ein Trainings-Export mit Einheiten, Übungen und Sätzen.')
      setCsvWorkouts(workouts)
      setCsvPlan(planCsvImport(workouts, days ?? [], activePlan?.week ?? 1))
    } catch (err) {
      setCsvFehler(fehlertext(err, 'Datei konnte nicht gelesen werden.'))
    } finally {
      setCsvLaedt(false)
    }
  }

  const csvEinlesen = async () => {
    if (!csvPlan || !csvPlan.saetze.length) return
    setCsvFehler(null)
    importCsvSets.mutate(csvPlan.saetze)
    setCsvErfolg(csvPlan.saetze.length)
    setCsvDatei(null)
    setCsvWorkouts(null)
    setCsvPlan(null)
  }

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Excel-Import</span>
          <h2>Import</h2>
        </div>
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <div
          className="drop"
          tabIndex={0}
          role="button"
          aria-label="Excel-Datei wählen"
          onClick={() => document.getElementById('xlsxInput')?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) void dateiGewaehlt(f)
          }}
        >
          <strong>Datei hier ablegen</strong>
          <p>oder klicken zum Auswählen · nur .xlsx</p>
          <input
            id="xlsxInput"
            type="file"
            accept=".xlsx"
            hidden
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void dateiGewaehlt(f)
            }}
          />
        </div>

        <details className="xlsxhilfe" style={{ marginTop: 14 }}>
          <summary>
            <span>
              <b>Excel-Struktur</b>
              <small>Welcher Aufbau wird erkannt?</small>
            </span>
          </summary>
          <div className="xh-inhalt">
            <h4>Blätter (Tabellenreiter)</h4>
            <ul className="xh-liste">
              <li>
                <span className="mono">Tag 1</span>, <span className="mono">Tag 2</span>, … — je ein Trainingstag. Kopfzeile mit „Übung“ in
                Spalte B, darunter je Übung: B=Name, C=Schema, D=Pause, M=Notiz.
              </li>
              <li>
                <span className="mono">Bankdrücken Block</span> — optional. Vier Label-Zeilen (B=Label, C=Wert): „Arbeitsgewicht“,
                „Wiederholungen dabei“, „Wiederholungen in Reserve“, „Scheibenstufe“. Danach zwei Blöcke mit Kopf „% vom 1RM“ in Spalte D,
                gefolgt von vier Prozentzeilen.
              </li>
              <li>
                <span className="mono">Wochenvolumen</span> — optional. Kopfzeile mit „Muskelgruppe“ in Spalte B, je Zeile B=Name,
                C/D/E=Sätze je Tag, G=Notiz.
              </li>
            </ul>
          </div>
        </details>

        {laedt && <p className="muted tiny" style={{ marginTop: 12 }}>Datei wird gelesen …</p>}
        {fehler && <p className="auth-msg err" style={{ marginTop: 12 }}>{fehler}</p>}

        {geparst && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <p className="mono tiny muted" style={{ letterSpacing: '.1em', textTransform: 'uppercase', margin: '0 0 9px' }}>
              {datei?.name} · {geparst.days.length} Tage · {gesamtUebungen} Übungen
              {geparst.bench ? ' · Bank-Block gefunden' : ''}
              {geparst.volume.length ? ` · ${geparst.volume.length} Volumen-Zeilen` : ''}
            </p>

            <div className="pills" role="group" aria-label="Plan-Art" style={{ marginBottom: 12 }}>
              <button className={'pill' + (typ === 'bench' ? ' on' : '')} onClick={() => setTyp('bench')}>
                Bankfokus
              </button>
              <button className={'pill' + (typ === 'general' ? ' on' : '')} onClick={() => setTyp('general')}>
                Standard
              </button>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <input className="inp" value={name} onChange={e => setName(e.target.value)} maxLength={40} style={{ maxWidth: 320 }} />
              <button className="btn primary sm" disabled={!name.trim() || importPlan.isPending} onClick={einlesen}>
                Anlegen &amp; einlesen
              </button>
            </div>

            <div className="tagliste" style={{ marginTop: 14 }}>
              {geparst.days.map(d => (
                <div key={d.name} className="card" style={{ padding: 12 }}>
                  <b>{d.name}</b>
                  <p className="muted tiny" style={{ margin: '4px 0 0' }}>
                    {d.exercises.length} Übungen: {d.exercises.map(e => e.name).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={cssVars({ '--i': 2 })}>
        <h3>
          <span className="tick" style={{ background: 'var(--violet)' }} />
          CSV-Import (Verlauf)
        </h3>
        <p className="muted tiny" style={{ margin: '2px 0 12px' }}>
          Bringt aufgezeichnete Einheiten aus einem Trainings-Tracker-Export (z. B. AlphaProgression) in den aktuell
          aktiven Plan{activePlan ? ` „${activePlan.name}“` : ''}.
        </p>

        {!activePlan && <p className="muted tiny">Erst einen Plan anlegen oder auswählen, dann steht diese Funktion bereit.</p>}

        {activePlan && (
          <>
            <div
              className="drop"
              tabIndex={0}
              role="button"
              aria-label="CSV-Datei wählen"
              onClick={() => document.getElementById('csvInput')?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) void csvDateiGewaehlt(f)
              }}
            >
              <strong>CSV hier ablegen</strong>
              <p>oder klicken zum Auswählen · nur .csv</p>
              <input
                id="csvInput"
                type="file"
                accept=".csv"
                hidden
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void csvDateiGewaehlt(f)
                }}
              />
            </div>

            {csvLaedt && <p className="muted tiny" style={{ marginTop: 12 }}>Datei wird gelesen …</p>}
            {csvFehler && <p className="auth-msg err">{csvFehler}</p>}
            {csvErfolg != null && <p className="auth-msg ok">{csvErfolg} Sätze importiert.</p>}

            {csvWorkouts && csvPlan && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <p className="mono tiny muted" style={{ letterSpacing: '.1em', textTransform: 'uppercase', margin: '0 0 9px' }}>
                  {csvDatei?.name} · {csvWorkouts.length} Einheiten · {csvPlan.saetze.length} Sätze zuordenbar
                </p>
                {csvPlan.unmatchedNamen.length > 0 && (
                  <p className="muted tiny" style={{ margin: '0 0 12px' }}>
                    Nicht zugeordnet (keine passende Übung im Plan gefunden): {csvPlan.unmatchedNamen.join(', ')}
                  </p>
                )}
                <button
                  className="btn primary sm"
                  disabled={!csvPlan.saetze.length || importCsvSets.isPending}
                  onClick={() => void csvEinlesen()}
                >
                  In „{activePlan.name}“ einlesen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
