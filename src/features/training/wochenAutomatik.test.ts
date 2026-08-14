import { describe, it, expect } from 'vitest'
import { naechsteWoche } from './wochenAutomatik'
import type { Plan } from '../../types/db'

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'p1', user_id: 'u1', name: 'Test', typ: 'general', week: 1, week_started_at: '2026-01-01T00:00:00.000Z',
    sort_order: 0, work: null, reps: null, rir: null, plate: 2.5, block: 1, goal: null, goal_from: null,
    beruehrt: true, rpe: null, last_delta_note: null, created_at: '', updated_at: '',
    ...patch,
  }
}

describe('naechsteWoche', () => {
  it('rührt nichts an, solange keine 7 Tage vergangen sind', () => {
    const p = plan({ week_started_at: '2026-01-01T00:00:00.000Z' })
    const jetzt = new Date('2026-01-07T23:00:00.000Z') // knapp unter 7 Tagen
    expect(naechsteWoche(p, jetzt)).toBeNull()
  })

  it('schaltet bei einem Standardplan nach genau 7 Tagen eine Woche weiter', () => {
    const p = plan({ week: 3, week_started_at: '2026-01-01T00:00:00.000Z' })
    const jetzt = new Date('2026-01-08T00:00:00.000Z')
    const r = naechsteWoche(p, jetzt)
    expect(r).toEqual({ week: 4, week_started_at: '2026-01-08T00:00:00.000Z' })
  })

  it('springt bei mehreren vergangenen Wochen in einem Schritt weiter, statt nur um eins', () => {
    const p = plan({ week: 1, week_started_at: '2026-01-01T00:00:00.000Z' })
    const jetzt = new Date('2026-01-22T00:00:00.000Z') // 21 Tage = 3 Wochen
    const r = naechsteWoche(p, jetzt)
    expect(r).toEqual({ week: 4, week_started_at: '2026-01-22T00:00:00.000Z' })
  })

  it('verschiebt week_started_at um volle Wochen, nicht auf den Aufrufzeitpunkt', () => {
    // 10 Tage vergangen: nur eine volle Woche zählt, der Rest bleibt stehen
    // statt den Wochentag zu verschieben.
    const p = plan({ week: 1, week_started_at: '2026-01-01T00:00:00.000Z' })
    const jetzt = new Date('2026-01-11T00:00:00.000Z')
    const r = naechsteWoche(p, jetzt)
    expect(r?.week_started_at).toBe('2026-01-08T00:00:00.000Z')
  })

  it('zählt bei Standardplänen unbegrenzt weiter', () => {
    const p = plan({ week: 40, week_started_at: '2026-01-01T00:00:00.000Z' })
    const jetzt = new Date('2026-01-08T00:00:00.000Z')
    expect(naechsteWoche(p, jetzt)?.week).toBe(41)
  })

  it('deckelt Bankfokus-Pläne bei Woche 4 — Deload endet über die Sätze, nicht den Kalender', () => {
    const p = plan({ typ: 'bench', week: 3, week_started_at: '2026-01-01T00:00:00.000Z' })
    const weitEntfernt = new Date('2026-03-01T00:00:00.000Z')
    expect(naechsteWoche(p, weitEntfernt)?.week).toBe(4)

    const inDeload = plan({ typ: 'bench', week: 4, week_started_at: '2026-01-01T00:00:00.000Z' })
    expect(naechsteWoche(inDeload, weitEntfernt)).toBeNull()
  })

  it('lässt einen frisch gestarteten Plan unangetastet', () => {
    const p = plan({ week: 1, week_started_at: new Date().toISOString() })
    expect(naechsteWoche(p, new Date())).toBeNull()
  })
})
