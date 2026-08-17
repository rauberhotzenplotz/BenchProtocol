import type { ReactNode } from 'react'
import type { DayWithExercises } from '../training/queries'
import { type UebungsDauerSchnitt } from '../training/calc'
import { tagFarbe } from '../training/dayColor'
import { prozentAenderung } from './calc'
import type { TrainingSession } from '../../types/db'
import { Sparkline } from '../../components/Sparkline'
import { CountUp } from '../../components/CountUp'
import { KachelKarte } from './KachelKarte'
import { ListChart } from './ListChart'

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

/** Tage seit der letzten Einheit — die einzige Kennzahl im Cockpit, die
    beantwortet, ob man noch im Rhythmus liegt. Bewusst ohne Einheit: die
    Beschriftung sagt schon "Tage", und ein zweites Wort neben der großen
    Zahl passt in der schmalsten Kachel (146 px) nicht mehr daneben. */
export function RuhetageCard({ tage }: { tage: number | null }) {
  return <KpiCard label="Ruhetage" value={tage == null ? '—' : <CountUp value={tage} />} />
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

/** durchschnittsDauerJeUebung() liefert bereits absteigend sortiert — die
    längste Übung steht damit von selbst ganz oben, genau wie gewünscht. */
export function UebungsdauerCard({ eintraege }: { eintraege: UebungsDauerSchnitt[] }) {
  if (eintraege.length < 2) {
    return <KachelKarte titel="Ø Dauer je Übung" wert="—" hinweis="noch zu wenig abgehakt" />
  }

  const liste = eintraege.slice(0, 12)
  const laengste = liste[0]

  return (
    <KachelKarte titel="Ø Dauer je Übung" wert={laengste.minuten.toFixed(1)} einheit="min" hinweis={`längste: ${laengste.name}`}>
      <ListChart
        ariaLabel="Durchschnittliche Dauer je Übung, längste zuerst"
        zeilen={liste.map(e => ({
          id: e.id,
          name: e.name,
          wert: e.minuten,
          wertText: `${e.minuten.toFixed(1)} min`,
          farbe: '#8B7CFF',
        }))}
      />
    </KachelKarte>
  )
}

export function LetzteEinheitenCard({ sessions, days }: { sessions: TrainingSession[]; days: DayWithExercises[] }) {
  // useAllSessionsForDays sortiert bereits absteigend nach Startzeit —
  // die jüngste Einheit steht dadurch oben.
  const liste = sessions.filter(s => s.status === 'completed').slice(0, 10)
  if (!liste.length) {
    return <KachelKarte titel="Letzte Einheiten" wert="—" hinweis="noch keine beendet" />
  }

  const zuletzt = days.find(d => d.id === liste[0].day_id)?.name ?? '—'

  return (
    <KachelKarte titel="Letzte Einheiten" wert={liste.length} hinweis={`zuletzt ${zuletzt}`}>
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
    </KachelKarte>
  )
}
