import { describe, it, expect } from 'vitest'
import { ruhetage } from './calc'
import type { TrainingSession } from '../../types/db'

function session(patch: Partial<TrainingSession>): TrainingSession {
  return {
    id: 's1',
    day_id: 'd1',
    user_id: 'u1',
    week: 1,
    started_at: '2026-08-17T10:00:00.000Z',
    ended_at: '2026-08-17T11:00:00.000Z',
    minutes: 60,
    status: 'completed',
    paused_at: null,
    ...patch,
  }
}

const jetzt = new Date('2026-08-20T09:00:00').getTime()

describe('ruhetage', () => {
  it('bleibt ohne aufgezeichnete Einheit null', () => {
    expect(ruhetage([], jetzt)).toBeNull()
  })

  it('zählt die Kalendertage seit der letzten Einheit', () => {
    const s = session({ started_at: new Date('2026-08-17T20:00:00').toISOString() })
    expect(ruhetage([s], jetzt)).toBe(3)
  })

  it('zählt eine Einheit von heute als 0, egal zu welcher Uhrzeit', () => {
    const s = session({ started_at: new Date('2026-08-20T05:30:00').toISOString() })
    expect(ruhetage([s], jetzt)).toBe(0)
  })

  it('nimmt die jüngste von mehreren Einheiten', () => {
    const alt = session({ id: 'a', started_at: new Date('2026-08-10T10:00:00').toISOString() })
    const neu = session({ id: 'b', started_at: new Date('2026-08-19T10:00:00').toISOString() })
    expect(ruhetage([alt, neu], jetzt)).toBe(1)
  })

  it('ignoriert übersprungene und noch laufende Einheiten', () => {
    const uebersprungen = session({ id: 'a', status: 'skipped', started_at: new Date('2026-08-19T10:00:00').toISOString() })
    const laeuft = session({ id: 'b', ended_at: null, started_at: new Date('2026-08-20T08:00:00').toISOString() })
    const echt = session({ id: 'c', started_at: new Date('2026-08-15T10:00:00').toISOString() })
    expect(ruhetage([uebersprungen, laeuft, echt], jetzt)).toBe(5)
  })
})
