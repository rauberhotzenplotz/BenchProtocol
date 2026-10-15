import { describe, it, expect } from 'vitest'
import { satzGesteigert, steigerungen, workoutNummer, wochenSerie, dauerStunden, anzeigeDauer } from './abschluss'
import type { LoggedSet, TrainingSession } from '../../types/db'

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's1', exercise_id: 'ex1', user_id: 'u1', week: 2, position: 0,
    kg: 60, reps: 10, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '',
    ...patch,
  }
}

function einheit(patch: Partial<TrainingSession>): Pick<TrainingSession, 'id' | 'started_at' | 'ended_at' | 'status'> {
  return { id: 'e1', started_at: '2026-10-12T10:00:00', ended_at: '2026-10-12T11:00:00', status: 'completed', ...patch }
}

describe('satzGesteigert', () => {
  it('zählt mehr Gewicht oder mehr Wiederholungen', () => {
    expect(satzGesteigert({ kg: 62.5, reps: 10 }, { kg: 60, reps: 10 })).toBe(true)
    expect(satzGesteigert({ kg: 60, reps: 11 }, { kg: 60, reps: 10 })).toBe(true)
  })
  it('zählt nichts, was in einem Wert schlechter ist', () => {
    expect(satzGesteigert({ kg: 85, reps: 3 }, { kg: 82.5, reps: 4 })).toBe(false)
    expect(satzGesteigert({ kg: 60, reps: 10 }, { kg: 60, reps: 10 })).toBe(false)
  })
  it('zählt nichts ohne Werte', () => {
    expect(satzGesteigert({ kg: null, reps: 10 }, { kg: 60, reps: 10 })).toBe(false)
  })
})

describe('steigerungen', () => {
  it('vergleicht Satz für Satz an derselben Position', () => {
    const heute = [satz({ position: 0, reps: 11 }), satz({ position: 1, reps: 10 }), satz({ position: 2, kg: 65 })]
    const letzte = [satz({ position: 0 }), satz({ position: 1 }), satz({ position: 2 })]
    expect(steigerungen(heute, letzte)).toBe(2)
  })
  it('zählt nur abgehakte Sätze', () => {
    expect(steigerungen([satz({ reps: 12, done: false })], [satz({})])).toBe(0)
  })
  it('zählt einen zusätzlichen Satz ohne Gegenstück nicht', () => {
    expect(steigerungen([satz({ position: 3, reps: 12 })], [satz({ position: 0 })])).toBe(0)
  })
})

describe('workoutNummer', () => {
  it('zählt die laufende Einheit mit', () => {
    expect(workoutNummer([einheit({ id: 'a' }), einheit({ id: 'b' })], 'neu')).toBe(3)
  })
  it('zählt die laufende nicht doppelt, wenn sie schon beendet ist', () => {
    expect(workoutNummer([einheit({ id: 'a' }), einheit({ id: 'neu' })], 'neu')).toBe(2)
  })
  it('lässt übersprungene und offene Einheiten weg', () => {
    expect(workoutNummer([einheit({ id: 'a', status: 'skipped' }), einheit({ id: 'b', ended_at: null })])).toBe(1)
  })
})

describe('wochenSerie', () => {
  const jetzt = new Date('2026-10-15T14:00:00') // Donnerstag

  it('zählt die laufende Woche auch ohne beendete Einheit', () => {
    expect(wochenSerie([], jetzt)).toBe(1)
  })
  it('zählt Wochen am Stück rückwärts', () => {
    const e = [
      einheit({ id: 'a', ended_at: '2026-10-06T18:00:00' }), // Vorwoche (Di)
      einheit({ id: 'b', ended_at: '2026-09-28T09:00:00' }), // vorletzte (Mo)
    ]
    expect(wochenSerie(e, jetzt)).toBe(3)
  })
  it('reißt an der ersten Woche ohne Einheit', () => {
    const e = [einheit({ id: 'a', ended_at: '2026-09-29T18:00:00' })] // vor zwei Wochen
    expect(wochenSerie(e, jetzt)).toBe(1)
  })
  it('ordnet Sonntagabend noch der alten Woche zu', () => {
    const e = [einheit({ id: 'a', ended_at: '2026-10-11T23:30:00' })] // So der Vorwoche
    expect(wochenSerie(e, jetzt)).toBe(2)
  })
  it('läuft über die Zeitumstellung Ende Oktober', () => {
    const nachUmstellung = new Date('2026-10-28T12:00:00')
    const e = [einheit({ id: 'a', ended_at: '2026-10-21T12:00:00' })]
    expect(wochenSerie(e, nachUmstellung)).toBe(2)
  })
  it('lässt übersprungene Einheiten weg', () => {
    const e = [einheit({ id: 'a', ended_at: '2026-10-06T18:00:00', status: 'skipped' })]
    expect(wochenSerie(e, jetzt)).toBe(1)
  })
})

describe('anzeigeDauer', () => {
  it('lässt echte Einheiten durch', () => {
    expect(anzeigeDauer(72)).toBe(72)
    expect(anzeigeDauer(720)).toBe(720)
  })
  it('verwirft vergessene Einheiten', () => {
    expect(anzeigeDauer(838 * 60 + 49)).toBeNull()
  })
})

describe('dauerStunden', () => {
  it('formatiert Stunden und Minuten', () => {
    expect(dauerStunden(2)).toBe('0:02')
    expect(dauerStunden(65)).toBe('1:05')
    expect(dauerStunden(-3)).toBe('0:00')
  })
})
