import { describe, it, expect } from 'vitest'
import { wdhBereich, progressionsVorschlag, vorschlagFuer } from './progression'
import type { LoggedSet } from '../../types/db'

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's1', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0,
    kg: 60, reps: 10, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '',
    ...patch,
  }
}

describe('wdhBereich', () => {
  it('liest einen Bereich mit Gedankenstrich', () => {
    expect(wdhBereich('3 × 8–12')).toEqual({ min: 8, max: 12 })
  })
  it('liest Bindestrich, "x" und "bis"', () => {
    expect(wdhBereich('3x8-12')).toEqual({ min: 8, max: 12 })
    expect(wdhBereich('4 × 6 bis 8')).toEqual({ min: 6, max: 8 })
  })
  it('macht aus einer festen Zahl einen Bereich ohne Breite', () => {
    expect(wdhBereich('4 × 8')).toEqual({ min: 8, max: 8 })
  })
  it('dreht verdrehte Angaben um', () => {
    expect(wdhBereich('3 × 12–8')).toEqual({ min: 8, max: 12 })
  })
  it('gibt null ohne Wiederholungsangabe', () => {
    expect(wdhBereich('nach Gefühl')).toBeNull()
    expect(wdhBereich(null)).toBeNull()
  })
})

describe('progressionsVorschlag', () => {
  it('steigert das Gewicht, wenn jeder Satz das obere Ende erreicht hat', () => {
    const p = progressionsVorschlag(
      [satz({ position: 0, reps: 12 }), satz({ position: 1, reps: 12 })],
      '2 × 8–12',
      2.5,
    )
    expect(p?.art).toBe('gewicht')
    expect(p?.saetze).toEqual([
      { kg: 62.5, reps: 8, art: 'gewicht' },
      { kg: 62.5, reps: 8, art: 'gewicht' },
    ])
  })

  it('schiebt darunter die Wiederholungen um eins nach oben', () => {
    const p = progressionsVorschlag([satz({ reps: 9 }), satz({ position: 1, reps: 8 })], '2 × 8–12', 2.5)
    expect(p?.art).toBe('wdh')
    expect(p?.saetze.map(s => [s.kg, s.reps])).toEqual([[60, 10], [60, 9]])
  })

  it('behandelt jeden Satz für sich und erhält eine fallende Staffel', () => {
    const p = progressionsVorschlag(
      [satz({ position: 0, kg: 85, reps: 6 }), satz({ position: 1, kg: 82.5, reps: 5 }), satz({ position: 2, kg: 80, reps: 4 })],
      '3 × 4–6',
      2.5,
    )
    expect(p?.art).toBe('gewicht')
    expect(p?.saetze.map(s => [s.kg, s.reps])).toEqual([[87.5, 4], [82.5, 6], [80, 5]])
  })

  it('hält bei festem Ziel das Gewicht, bis es geschafft ist', () => {
    const p = progressionsVorschlag([satz({ reps: 7 })], '3 × 8', 2.5)
    expect(p?.saetze[0]).toEqual({ kg: 60, reps: 8, art: 'wdh' })
  })

  it('stuft nach einem verpassten Satz nicht ab, sondern will eine Wiederholung mehr', () => {
    const p = progressionsVorschlag([satz({ reps: 5 })], '3 × 8–12', 2.5)
    expect(p?.saetze[0]).toEqual({ kg: 60, reps: 6, art: 'wdh' })
  })

  it('steigert nicht, wenn das obere Ende nur mit RPE 9,5 oder mehr kam', () => {
    const p = progressionsVorschlag([satz({ reps: 12, rpe: 10 })], '3 × 8–12', 2.5)
    expect(p?.art).toBe('halten')
    expect(p?.saetze[0]).toEqual({ kg: 60, reps: 12, art: 'halten' })
    expect(p?.grund).toMatch(/RPE/)
  })

  it('nutzt die Scheibenstufe des Plans', () => {
    const p = progressionsVorschlag([satz({ reps: 12 })], '3 × 8–12', 1.25)
    expect(p?.saetze[0].kg).toBe(61.25)
  })

  it('hält in der Deload-Woche alles wie zuletzt', () => {
    const p = progressionsVorschlag([satz({ reps: 12 })], '3 × 8–12', 2.5, { deload: true })
    expect(p?.art).toBe('halten')
    expect(p?.saetze[0]).toEqual({ kg: 60, reps: 12, art: 'halten' })
  })

  it('zählt nur abgehakte Sätze, wenn es welche gibt', () => {
    const p = progressionsVorschlag(
      [satz({ position: 0, reps: 12 }), satz({ position: 1, reps: 3, done: false })],
      '3 × 8–12',
      2.5,
    )
    expect(p?.saetze).toHaveLength(1)
    expect(p?.art).toBe('gewicht')
  })

  it('sortiert nach Satzposition', () => {
    const p = progressionsVorschlag([satz({ position: 1, kg: 50 }), satz({ position: 0, kg: 70 })], '3 × 8–12', 2.5)
    expect(p?.saetze.map(s => s.kg)).toEqual([70, 50])
  })

  it('gibt null ohne letzte Einheit oder ohne Wiederholungsangabe', () => {
    expect(progressionsVorschlag([], '3 × 8–12', 2.5)).toBeNull()
    expect(progressionsVorschlag([satz({ kg: null })], '3 × 8–12', 2.5)).toBeNull()
    expect(progressionsVorschlag([satz({})], 'nach Gefühl', 2.5)).toBeNull()
  })
})

describe('vorschlagFuer', () => {
  it('nimmt für überzählige Zeilen den letzten Satz', () => {
    const p = progressionsVorschlag([satz({ reps: 9 })], '3 × 8–12', 2.5)
    expect(vorschlagFuer(p, 0)).toEqual({ kg: 60, reps: 10, art: 'wdh' })
    expect(vorschlagFuer(p, 3)).toEqual({ kg: 60, reps: 10, art: 'wdh' })
  })
  it('gibt null ohne Vorschlag', () => {
    expect(vorschlagFuer(null, 0)).toBeNull()
  })
})
