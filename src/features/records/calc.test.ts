import { describe, it, expect } from 'vitest'
import { gruppiere, besteRekorde } from './calc'
import type { Exercise, LoggedSet } from '../../types/db'

function exercise(patch: Partial<Exercise>): Exercise {
  return {
    id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Bankdrücken', scheme: '4 × 5', rest: '2 min',
    note: null, bench_slot: null, muscle_group: null, sort_order: 0, library_id: null,
    ...patch,
  }
}

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's1', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0,
    kg: 100, reps: 5, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '',
    ...patch,
  }
}

describe('gruppiere', () => {
  it('fasst Übungen mit derselben library_id zu einer Gruppe zusammen', () => {
    const uebungen = [
      exercise({ id: 'a', name: 'Bankdrücken Langhantel', library_id: 'lib1' }),
      exercise({ id: 'b', name: 'Bankdrücken Langhantel', library_id: 'lib1' }),
    ]
    const gruppen = gruppiere(uebungen)
    expect(gruppen).toHaveLength(1)
    expect(gruppen[0].exerciseIds.sort()).toEqual(['a', 'b'])
  })

  it('hält Übungen ohne library_id einzeln auseinander', () => {
    const uebungen = [
      exercise({ id: 'a', name: 'Klimmzüge', library_id: null }),
      exercise({ id: 'b', name: 'Klimmzüge', library_id: null }),
    ]
    const gruppen = gruppiere(uebungen)
    expect(gruppen).toHaveLength(2)
  })

  it('trennt unterschiedliche library_id auch bei gleichem Namen', () => {
    const uebungen = [
      exercise({ id: 'a', name: 'Bankdrücken', library_id: 'lib1' }),
      exercise({ id: 'b', name: 'Bankdrücken', library_id: 'lib2' }),
    ]
    expect(gruppiere(uebungen)).toHaveLength(2)
  })

  it('sortiert alphabetisch nach Namen', () => {
    const uebungen = [exercise({ id: 'a', name: 'Zercher Kniebeuge' }), exercise({ id: 'b', name: 'Ausfallschritte' })]
    expect(gruppiere(uebungen).map(g => g.name)).toEqual(['Ausfallschritte', 'Zercher Kniebeuge'])
  })
})

describe('besteRekorde', () => {
  it('fasst Sätze mehrerer exerciseIds zusammen (planübergreifend)', () => {
    const saetze = [
      satz({ exercise_id: 'a', kg: 100, reps: 5, week: 1 }),
      satz({ exercise_id: 'b', kg: 110, reps: 5, week: 3 }),
    ]
    const rekorde = besteRekorde(saetze, ['a', 'b'])
    expect(rekorde).toHaveLength(1)
    expect(rekorde[0]).toMatchObject({ reps: 5, kg: 110, woche: 3 })
  })

  it('behält je Wiederholungszahl nur den besten Satz', () => {
    const saetze = [
      satz({ exercise_id: 'a', kg: 100, reps: 5, week: 1 }),
      satz({ exercise_id: 'a', kg: 90, reps: 5, week: 2 }),
    ]
    const rekorde = besteRekorde(saetze, ['a'])
    expect(rekorde).toHaveLength(1)
    expect(rekorde[0].kg).toBe(100)
  })

  it('ignoriert Sätze außerhalb der übergebenen exerciseIds', () => {
    const saetze = [satz({ exercise_id: 'fremd', kg: 200, reps: 1 })]
    expect(besteRekorde(saetze, ['a'])).toEqual([])
  })

  it('ist ohne exerciseIds leer', () => {
    expect(besteRekorde([satz({})], [])).toEqual([])
  })

  it('sortiert nach Wiederholungszahl aufsteigend', () => {
    const saetze = [satz({ exercise_id: 'a', reps: 8, kg: 60 }), satz({ exercise_id: 'a', reps: 3, kg: 90 })]
    expect(besteRekorde(saetze, ['a']).map(r => r.reps)).toEqual([3, 8])
  })
})
