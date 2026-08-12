import { useState } from 'react'
import type { LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { tonnageOf, uebungsDauer, dauerKurz, wochenLabel } from './calc'
import { cssVars } from '../../lib/style'

const WOCHENTAG = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function isoLokal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Montag-basiertes Wochenraster: JS zählt Sonntag=0, wir wollen Montag=0. */
function montagIndex(jsWochentag: number): number {
  return (jsWochentag + 6) % 7
}

interface Props {
  plan: Plan
  days: DayWithExercises[]
  sessions: TrainingSession[]
  alleSaetze: LoggedSet[]
}

export function TrainingCalendar({ plan, days, sessions, alleSaetze }: Props) {
  const [jahr, setJahr] = useState(() => new Date().getFullYear())
  const [monat, setMonat] = useState(() => new Date().getMonth())
  const [heuteIso] = useState(() => isoLokal(Date.now()))
  const [gewaehlteIso, setGewaehlteIso] = useState<string | null>(null)

  const nachTag = new Map<string, TrainingSession[]>()
  sessions.forEach(s => {
    const iso = isoLokal(new Date(s.started_at).getTime())
    const liste = nachTag.get(iso) ?? []
    liste.push(s)
    nachTag.set(iso, liste)
  })

  const ersterDesMonats = new Date(jahr, monat, 1)
  const anzahlTage = new Date(jahr, monat + 1, 0).getDate()
  const startLeerraum = montagIndex(ersterDesMonats.getDay())
  const zellen: (number | null)[] = [
    ...Array(startLeerraum).fill(null),
    ...Array.from({ length: anzahlTage }, (_, i) => i + 1),
  ]
  while (zellen.length % 7 !== 0) zellen.push(null)

  const vorMonat = () => {
    if (monat === 0) { setMonat(11); setJahr(j => j - 1) } else setMonat(m => m - 1)
  }
  const naechsterMonat = () => {
    if (monat === 11) { setMonat(0); setJahr(j => j + 1) } else setMonat(m => m + 1)
  }

  const trainierteTage = [...nachTag.keys()].filter(iso => iso.startsWith(`${jahr}-${String(monat + 1).padStart(2, '0')}`))
  const minutenGesamt = trainierteTage.reduce(
    (a, iso) => a + (nachTag.get(iso) ?? []).reduce((b, s) => b + (s.minutes ?? 0), 0),
    0,
  )

  const gewaehlteSessions = gewaehlteIso ? (nachTag.get(gewaehlteIso) ?? []) : []

  return (
    <div className="card" style={cssVars({ '--i': 4 })}>
      <h3>
        <span className="tick" style={{ background: 'var(--magenta)' }} />
        Kalender
      </h3>

      {gewaehlteIso && gewaehlteSessions.length > 0 ? (
        <TagDetail iso={gewaehlteIso} sessions={gewaehlteSessions} days={days} plan={plan} alleSaetze={alleSaetze} onZurueck={() => setGewaehlteIso(null)} />
      ) : (
        <>
          <div className="row" style={{ margin: '2px 0 14px', alignItems: 'center' }}>
            <button className="btn sm ghost" onClick={vorMonat} aria-label="Vorheriger Monat">
              ←
            </button>
            <span className="spacer" />
            <b style={{ fontFamily: 'var(--f-display)', fontSize: 18, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {MONATE[monat]} {jahr}
            </b>
            <span className="spacer" />
            <button className="btn sm ghost" onClick={naechsterMonat} aria-label="Nächster Monat">
              →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
            {WOCHENTAG.map(w => (
              <div key={w} className="mono tiny muted" style={{ textAlign: 'center', letterSpacing: '.08em' }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {zellen.map((tag, i) => {
              if (tag == null) return <div key={i} />
              const iso = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
              const einheiten = nachTag.get(iso) ?? []
              const istHeute = iso === heuteIso
              const namen = einheiten.map(s => days.find(d => d.id === s.day_id)?.name ?? '—')
              const InhaltTag = einheiten.length ? 'button' : 'div'
              return (
                <InhaltTag
                  key={i}
                  onClick={einheiten.length ? () => setGewaehlteIso(iso) : undefined}
                  title={namen.map((n, j) => `${n}${einheiten[j].minutes ? ` · ${einheiten[j].minutes} min` : ''}`).join('\n') || undefined}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: `1px solid ${istHeute ? 'var(--neon)' : 'var(--line)'}`,
                    background: einheiten.length ? 'rgba(53,240,208,.1)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: 2,
                    cursor: einheiten.length ? 'pointer' : 'default',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <span className="mono tiny" style={{ color: istHeute ? 'var(--neon)' : 'var(--ink-2)' }}>
                    {tag}
                  </span>
                  {einheiten.length > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--neon)' }} />}
                </InhaltTag>
              )
            })}
          </div>

          <p className="muted tiny" style={{ marginTop: 13 }}>
            {trainierteTage.length === 0
              ? 'Noch keine aufgezeichnete Einheit diesen Monat.'
              : `${trainierteTage.length} ${trainierteTage.length === 1 ? 'Trainingstag' : 'Trainingstage'} diesen Monat${minutenGesamt ? ` · ${minutenGesamt} min insgesamt` : ''}`}
            {trainierteTage.length > 0 ? ' · antippen für Einzelheiten' : ''}
          </p>
        </>
      )}
    </div>
  )
}

function TagDetail({
  iso,
  sessions,
  days,
  plan,
  alleSaetze,
  onZurueck,
}: {
  iso: string
  sessions: TrainingSession[]
  days: DayWithExercises[]
  plan: Plan
  alleSaetze: LoggedSet[]
  onZurueck: () => void
}) {
  const langDatum = new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      <div className="row" style={{ marginBottom: 12, alignItems: 'center', gap: 10 }}>
        <button className="btn sm ghost" onClick={onZurueck} aria-label="Zurück zum Kalender">
          ‹ Kalender
        </button>
        <b style={{ fontFamily: 'var(--f-display)', fontSize: 16, letterSpacing: '.03em' }}>{langDatum}</b>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {sessions.map(session => {
          const tag = days.find(d => d.id === session.day_id)
          if (!tag) return null
          const saetzeDerWoche = alleSaetze.filter(s => tag.exercises.some(ex => ex.id === s.exercise_id) && s.week === session.week)
          const dauerJeUebung = uebungsDauer(tag.exercises, saetzeDerWoche, session.started_at)
          const uebungenMitSaetzen = tag.exercises
            .map(ex => ({ ex, saetze: saetzeDerWoche.filter(s => s.exercise_id === ex.id && s.kg != null).sort((a, b) => a.position - b.position) }))
            .filter(u => u.saetze.length > 0)
          const gesamtTonnage = uebungenMitSaetzen.reduce((a, u) => a + tonnageOf(u.saetze), 0)

          return (
            <div key={session.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="chip neon">{tag.name}</span>
                <span className="chip mute">{wochenLabel(session.week, plan)}</span>
                {session.minutes && <span className="chip mute">{session.minutes} min</span>}
                <span className="chip mute">{uebungenMitSaetzen.length} Übungen</span>
                {gesamtTonnage > 0 && <span className="chip mute">{Math.round(gesamtTonnage)} kg bewegt</span>}
              </div>

              {uebungenMitSaetzen.length === 0 ? (
                <p className="muted tiny">Keine Sätze mit Gewicht erfasst.</p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {uebungenMitSaetzen.map(({ ex, saetze }) => {
                    const dauer = dauerJeUebung.get(ex.id)
                    return (
                      <div key={ex.id}>
                        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                          <b style={{ fontSize: 13.5 }}>{ex.name}</b>
                          {dauer != null && <span className="mono tiny muted">{dauerKurz(dauer)} für diese Übung</span>}
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {saetze.map(s => (
                            <span key={s.id} className="chip mute mono tiny">
                              {s.kg} × {s.reps}
                              {s.rpe ? ` @${s.rpe}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
