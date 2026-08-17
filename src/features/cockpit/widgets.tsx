import type { ReactNode } from 'react'
import type { DayWithExercises } from '../training/queries'
import { type UebungsDauerSchnitt } from '../training/calc'
import { tagFarbe } from '../training/dayColor'
import { prozentAenderung } from './calc'
import type { TrainingSession } from '../../types/db'
import { Sparkline } from '../../components/Sparkline'
import { CountUp } from '../../components/CountUp'
import { BarChart } from './BarChart'

/** Ein Kennwert der Kopfzeile. Die Kacheln tragen keine eigene Farbe mehr
    (früher c1–c4): Farbe bedeutet in dieser App Trainingstag, und ein
    Kennwert gehört zu keinem — sie stand hier also nur herum. */
export function KpiCard({
  label,
  value,
  unit,
  spark,
  deltaPct,
}: {
  label: string
  value: ReactNode
  unit?: string
  spark?: number[]
  /** Veränderung in Prozent ggü. der Vorwoche, siehe prozentAenderung() in
      ./calc.ts — null/undefined blendet die Zeile komplett aus. */
  deltaPct?: number | null
}) {
  return (
    <div className="card kpi">
      <div className="lab">{label}</div>
      <div className="val">
        <span className="zahlglow">{value}</span>
        {unit && <u>{unit}</u>}
      </div>
      {deltaPct != null && (
        <div className={`sub ${deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : ''}`}>
          <svg viewBox="0 0 24 24">
            <path d={deltaPct < 0 ? 'M12 5v14M5 12l7 7 7-7' : 'M12 19V5M5 12l7-7 7 7'} />
          </svg>
          {deltaPct > 0 ? '+' : ''}
          {deltaPct} % ggü. Vorwoche
        </div>
      )}
      {spark && <Sparkline values={spark} />}
    </div>
  )
}

/** Soll/Ist der laufenden Woche als Messbalken statt als nackte Zahl: hier
    zählt nicht der Wert an sich, sondern wie viel vom Pensum noch offen
    ist — und das liest man an einem Balken schneller ab. */
export function WochenpensumCard({ erledigt, geplant }: { erledigt: number; geplant: number }) {
  const anteil = geplant ? Math.min(1, erledigt / geplant) : 0
  const fertig = geplant > 0 && erledigt >= geplant
  return (
    <div className="card kpi">
      <div className="lab">Einheiten diese Woche</div>
      <div className="val">
        <span className="zahlglow">{erledigt}</span>
        <u>von {geplant}</u>
      </div>
      <div className={'kpi-meter' + (fertig ? ' voll' : '')}>
        <i style={{ width: `${(anteil * 100).toFixed(0)}%` }} />
      </div>
    </div>
  )
}

export function TrainingszeitCard({ woche, vorwoche }: { woche: number; vorwoche?: number }) {
  return (
    <KpiCard
      label="Trainingszeit · 7 Tage"
      value={<CountUp value={woche} />}
      unit="min"
      deltaPct={vorwoche != null ? prozentAenderung(woche, vorwoche) : undefined}
    />
  )
}

export function UebungsdauerCard({ eintraege }: { eintraege: UebungsDauerSchnitt[] }) {
  if (eintraege.length < 2) {
    return (
      <div className="card">
        <h3>
          <span className="tick" />Ø Dauer je Übung
        </h3>
        <p className="muted tiny" style={{ padding: '22px 0', textAlign: 'center', margin: 0 }}>
          Sobald du Sätze mit Haken abschließt, steht hier, wie lange jede Übung im Schnitt dauert.
        </p>
      </div>
    )
  }
  const liste = eintraege.slice(0, 8)
  return (
    <div className="card">
      <h3>
        <span className="tick" />Ø Dauer je Übung
      </h3>
      <BarChart
        ariaLabel="Durchschnittliche Dauer je Übung"
        schrittRunden={1}
        yLabel={v => Math.round(v).toString()}
        schnittLabel={v => `${v.toFixed(1)} min`}
        punkte={liste.map(e => ({
          label: e.name.length > 9 ? e.name.slice(0, 8) + '…' : e.name,
          wert: e.minuten,
          farbe: '#8B7CFF',
          tipTitel: `${e.minuten.toFixed(1)} min`,
          tipZeilen: [e.name],
        }))}
      />
    </div>
  )
}

export function LetzteEinheitenCard({ sessions, days }: { sessions: TrainingSession[]; days: DayWithExercises[] }) {
  const liste = sessions.filter(s => s.status === 'completed').slice(0, 6)
  if (!liste.length) {
    return (
      <div className="card">
        <h3>
          <span className="tick" />
          Letzte Einheiten
        </h3>
        <p className="muted tiny" style={{ padding: '22px 0', textAlign: 'center', margin: 0 }}>
          Sobald du eine Einheit beendest, steht sie hier.
        </p>
      </div>
    )
  }
  return (
    <div className="card">
      <h3>
        <span className="tick" />
        Letzte Einheiten
      </h3>
      <div className="kalliste" style={{ maxHeight: 'none' }}>
        {liste.map(s => (
          <div key={s.id}>
            <i style={{ background: tagFarbe(days, s.day_id) }} />
            <span>{days.find(d => d.id === s.day_id)?.name ?? '—'}</span>
            <span className="dat">{new Date(s.started_at).toLocaleDateString('de-DE')}</span>
            <span className="dau">{s.minutes} min</span>
          </div>
        ))}
      </div>
    </div>
  )
}
