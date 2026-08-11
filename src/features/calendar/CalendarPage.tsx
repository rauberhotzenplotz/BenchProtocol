import { useState } from 'react'
import { useActivePlan } from '../plans/active-plan-context'
import { useDays, useAllSessionsForDays } from '../training/queries'
import { PlanPicker } from '../plans/PlanPicker'
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

export function CalendarPage() {
  const { activePlan } = useActivePlan()
  const { data: days } = useDays(activePlan?.id)
  const dayIds = (days ?? []).map(d => d.id)
  const { data: sessions } = useAllSessionsForDays(dayIds)

  const [jahr, setJahr] = useState(() => new Date().getFullYear())
  const [monat, setMonat] = useState(() => new Date().getMonth())
  const [heuteIso] = useState(() => isoLokal(Date.now()))

  if (!activePlan || !days) {
    return (
      <section className="view on frisch">
        <div className="view-head">
          <h2>Kalender</h2>
          <p>Noch kein Plan vorhanden.</p>
        </div>
      </section>
    )
  }

  const nachTag = new Map<string, { name: string; minutes: number | null }[]>()
  ;(sessions ?? []).forEach(s => {
    const iso = isoLokal(new Date(s.started_at).getTime())
    const tag = days.find(d => d.id === s.day_id)
    const liste = nachTag.get(iso) ?? []
    liste.push({ name: tag?.name ?? '—', minutes: s.minutes })
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
  const minutenGesamt = trainierteTage.reduce((a, iso) => a + (nachTag.get(iso) ?? []).reduce((b, e) => b + (e.minutes ?? 0), 0), 0)

  return (
    <section className="view on frisch">
      <div className="view-head" style={cssVars({ '--i': 0 })}>
        <div>
          <span className="eyebrow">{activePlan.name}</span>
          <h2>Kalender</h2>
          <p>Trainierte Tage im Überblick.</p>
        </div>
        <PlanPicker />
      </div>

      <div className="card" style={cssVars({ '--i': 1 })}>
        <div className="row" style={{ marginBottom: 14, alignItems: 'center' }}>
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
            return (
              <div
                key={i}
                title={einheiten.map(e => `${e.name}${e.minutes ? ` · ${e.minutes} min` : ''}`).join('\n') || undefined}
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
                }}
              >
                <span className="mono tiny" style={{ color: istHeute ? 'var(--neon)' : 'var(--ink-2)' }}>
                  {tag}
                </span>
                {einheiten.length > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--neon)' }} />}
              </div>
            )
          })}
        </div>

        <p className="muted tiny" style={{ marginTop: 13 }}>
          {trainierteTage.length} {trainierteTage.length === 1 ? 'Trainingstag' : 'Trainingstage'} diesen Monat
          {minutenGesamt ? ` · ${minutenGesamt} min insgesamt` : ''}
        </p>
      </div>
    </section>
  )
}
