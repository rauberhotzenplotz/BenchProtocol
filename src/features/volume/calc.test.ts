import { describe, it, expect } from 'vitest'
import { istSaetzeJeGruppeUndTag, istGesamt, gesamtWochenVolumen } from './calc'
import type { DayWithExercises } from '../training/queries'
import type { Exercise, LoggedSet } from '../../types/db'

function exercise(patch: Partial<Exercise>): Exercise {
  return { id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Übung', scheme: '3 × 10', rest: null, note: null, bench_slot: null, muscle_group: null, sort_order: 0, ...patch }
}

function tag(id: string, exercises: Exercise[]): DayWithExercises {
  return { id, plan_id: 'p1', user_id: 'u1', name: id, sub: null, sort_order: 0, exercises }
}

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return { id: 's', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0, kg: null, reps: null, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '', ...patch }
}

describe('istSaetzeJeGruppeUndTag', () => {
  it('zählt nur abgehakte Sätze von Übungen mit Muskelgruppen-Zuordnung', () => {
    const brust = exercise({ id: 'ex1', muscle_group: 'Brust' })
    const ohneGruppe = exercise({ id: 'ex2', muscle_group: null })
    const days = [tag('d1', [brust, ohneGruppe])]
    const setsByExercise = new Map<string, LoggedSet[]>([
      ['ex1', [satz({ exercise_id: 'ex1', done: true }), satz({ exercise_id: 'ex1', done: true }), satz({ exercise_id: 'ex1', done: false })]],
      ['ex2', [satz({ exercise_id: 'ex2', done: true })]],
    ])

    const tabelle = istSaetzeJeGruppeUndTag(days, setsByExercise)

    expect(tabelle.get('Brust')?.get('d1')).toBe(2)
    expect(tabelle.has('ex2')).toBe(false)
    expect([...tabelle.keys()]).toEqual(['Brust'])
  })

  it('summiert mehrere Übungen derselben Muskelgruppe am selben Tag', () => {
    const bankdruecken = exercise({ id: 'ex1', muscle_group: 'Brust' })
    const flys = exercise({ id: 'ex2', muscle_group: 'Brust' })
    const days = [tag('d1', [bankdruecken, flys])]
    const setsByExercise = new Map<string, LoggedSet[]>([
      ['ex1', [satz({ exercise_id: 'ex1', done: true }), satz({ exercise_id: 'ex1', done: true })]],
      ['ex2', [satz({ exercise_id: 'ex2', done: true })]],
    ])

    const tabelle = istSaetzeJeGruppeUndTag(days, setsByExercise)

    expect(tabelle.get('Brust')?.get('d1')).toBe(3)
  })
})

describe('istGesamt', () => {
  it('summiert alle Tage einer Muskelgruppe', () => {
    const proTag = new Map([['d1', 3], ['d2', 5]])
    expect(istGesamt(proTag)).toBe(8)
  })

  it('liefert 0 für eine unbekannte Muskelgruppe', () => {
    expect(istGesamt(undefined)).toBe(0)
  })
})

describe('gesamtWochenVolumen', () => {
  it('zählt abgehakte Sätze über alle zugeordneten Übungen und Tage', () => {
    const days = [
      tag('d1', [exercise({ id: 'ex1', muscle_group: 'Brust' })]),
      tag('d2', [exercise({ id: 'ex2', muscle_group: 'Rücken' }), exercise({ id: 'ex3', muscle_group: null })]),
    ]
    const setsByExercise = new Map<string, LoggedSet[]>([
      ['ex1', [satz({ exercise_id: 'ex1', done: true }), satz({ exercise_id: 'ex1', done: true })]],
      ['ex2', [satz({ exercise_id: 'ex2', done: true })]],
      ['ex3', [satz({ exercise_id: 'ex3', done: true }), satz({ exercise_id: 'ex3', done: true })]],
    ])

    expect(gesamtWochenVolumen(days, setsByExercise)).toBe(3)
  })

  it('liefert 0, wenn keine Übung eine Muskelgruppe hat', () => {
    const days = [tag('d1', [exercise({ id: 'ex1', muscle_group: null })])]
    const setsByExercise = new Map<string, LoggedSet[]>([['ex1', [satz({ done: true })]]])

    expect(gesamtWochenVolumen(days, setsByExercise)).toBe(0)
  })
})
