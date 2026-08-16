import { describe, it, expect } from 'vitest'
import { aufwaermPlan, istBankdruecken } from './calc'
import type { Exercise } from '../../types/db'

function exercise(patch: Partial<Exercise>): Exercise {
  return { id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Bankdrücken', scheme: '4 × 5', rest: '2 min', note: null, bench_slot: null, muscle_group: null, sort_order: 0, ...patch }
}

describe('istBankdruecken', () => {
  it('erkennt über die Bank-Zuordnung', () => {
    expect(istBankdruecken(exercise({ name: 'Irgendwas', bench_slot: 'd1' }))).toBe(true)
  })

  it('erkennt über den Namen, auch ohne Bank-Zuordnung', () => {
    expect(istBankdruecken(exercise({ name: 'Bench Press', bench_slot: null }))).toBe(true)
  })

  it('erkennt andere Übungen nicht als Bankdrücken', () => {
    expect(istBankdruecken(exercise({ name: 'Kniebeuge', bench_slot: null }))).toBe(false)
  })
})

describe('aufwaermPlan', () => {
  it('liefert die volle Leiter fürs Bankdrücken', () => {
    const plan = aufwaermPlan(true, 100, 2.5)
    expect(plan.map(s => s.label)).toEqual(['Leere Stange', '50 %', '65 %', '75 %'])
  })

  it('lässt Stufen unter der leeren Stange weg', () => {
    const plan = aufwaermPlan(true, 30, 2.5)
    expect(plan.every(s => s.kg > 20 || s.label === 'Leere Stange')).toBe(true)
  })

  it('bleibt ohne Gewicht leer', () => {
    expect(aufwaermPlan(true, 0, 2.5)).toEqual([])
  })

  it('bleibt bei anderen Übungen leer, egal wie schwer', () => {
    expect(aufwaermPlan(false, 200, 2.5)).toEqual([])
  })
})
