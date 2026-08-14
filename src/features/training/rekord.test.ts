import { describe, it, expect } from 'vitest'
import { bestesE1rm, istRekord } from './rekord'
import type { LoggedSet } from '../../types/db'

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0,
    kg: 100, reps: 5, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '',
    ...patch,
  }
}

describe('bestesE1rm', () => {
  it('nimmt den höchsten Wert der Übung', () => {
    // 100×5 = 116,7 · 110×3 = 121 · 105×5 = 122,5
    const sets = [satz({ kg: 100, reps: 5 }), satz({ kg: 110, reps: 3 }), satz({ kg: 105, reps: 5 })]
    expect(bestesE1rm(sets, 'ex1')).toBeCloseTo(122.5, 1)
  })

  it('lässt andere Übungen außen vor', () => {
    const sets = [satz({ kg: 100, reps: 5 }), satz({ exercise_id: 'ex2', kg: 200, reps: 5 })]
    expect(bestesE1rm(sets, 'ex1')).toBeCloseTo(116.67, 1)
  })

  it('zählt nur abgehakte Sätze — Eingetipptes ohne Haken ist nicht geleistet', () => {
    const sets = [satz({ kg: 100, reps: 5 }), satz({ kg: 300, reps: 5, done: false })]
    expect(bestesE1rm(sets, 'ex1')).toBeCloseTo(116.67, 1)
  })

  it('übergeht Sätze ohne Gewicht oder Wiederholungen', () => {
    const sets = [satz({ kg: null }), satz({ reps: null }), satz({ kg: 100, reps: 5 })]
    expect(bestesE1rm(sets, 'ex1')).toBeCloseTo(116.67, 1)
  })

  it('liefert 0, wenn es nichts Verwertbares gibt', () => {
    expect(bestesE1rm([], 'ex1')).toBe(0)
    expect(bestesE1rm([satz({ kg: null, reps: null })], 'ex1')).toBe(0)
  })
})

describe('istRekord', () => {
  const frueher = [satz({ kg: 100, reps: 5 })] // e1RM 116,67

  it('erkennt eine echte Steigerung', () => {
    expect(istRekord(105, 5, frueher, 'ex1')).toBe(true) // 122,5
  })

  it('erkennt auch mehr Wiederholungen bei gleichem Gewicht als Rekord', () => {
    expect(istRekord(100, 6, frueher, 'ex1')).toBe(true) // 120
  })

  it('lässt eine Wiederholung des bisherigen Bestwerts nicht gelten', () => {
    expect(istRekord(100, 5, frueher, 'ex1')).toBe(false)
  })

  it('ignoriert Zugewinne unterhalb der Schwelle', () => {
    // 100,1 × 5 = 116,78 — knapp drüber, aber keine 0,5 kg
    expect(istRekord(100.1, 5, frueher, 'ex1')).toBe(false)
  })

  it('feiert den allerersten Satz einer Übung nicht', () => {
    expect(istRekord(100, 5, [], 'ex1')).toBe(false)
  })

  it('vergleicht nur innerhalb derselben Übung', () => {
    const fremd = [satz({ exercise_id: 'ex2', kg: 300, reps: 5 })]
    // Gegen die eigene Übung liegt nichts vor — also kein Rekord.
    expect(istRekord(100, 5, fremd, 'ex1')).toBe(false)
  })

  it('kommt mit fehlenden Eingaben zurecht', () => {
    expect(istRekord(null, 5, frueher, 'ex1')).toBe(false)
    expect(istRekord(105, null, frueher, 'ex1')).toBe(false)
    expect(istRekord(0, 5, frueher, 'ex1')).toBe(false)
  })
})
