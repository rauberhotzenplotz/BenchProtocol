import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { parseWorkbook, type ParsedWorkbook } from './xlsxParse'
import { importAlsNeuerPlan } from './importPlan'
import { useActivePlan } from '../plans/active-plan-context'
import type { PlanTyp } from '../../types/db'
import { cssVars } from '../../lib/style'

export function ImportPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setActivePlanId } = useActivePlan()

  const [datei, setDatei] = useState<File | null>(null)
  const [geparst, setGeparst] = useState<ParsedWorkbook | null>(null)
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<PlanTyp>('general')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [anlegen, setAnlegen] = useState(false)

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

  const einlesen = async () => {
    if (!geparst || !name.trim()) return
    setAnlegen(true)
    setFehler(null)
    try {
      const plan = await importAlsNeuerPlan(geparst, name.trim(), typ)
      await qc.invalidateQueries({ queryKey: ['plans'] })
      setActivePlanId(plan.id)
      navigate('/training')
    } catch (err) {
      setFehler(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Import fehlgeschlagen.')
    } finally {
      setAnlegen(false)
    }
  }

  const gesamtUebungen = geparst?.days.reduce((a, d) => a + d.exercises.length, 0) ?? 0

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">Excel-Import</span>
          <h2>Import</h2>
          <p>Eine .xlsx-Datei mit „Tag N“-Blättern einlesen und daraus einen neuen Plan anlegen.</p>
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
              <button className="btn primary sm" disabled={!name.trim() || anlegen} onClick={() => void einlesen()}>
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
    </section>
  )
}
