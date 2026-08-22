import { describe, it, expect } from 'vitest'
import { aufwaermPlan, istBankdruecken, satzE1rm, letzteEinheitFuerUebung, muskelgruppenDesTags, wocheErledigt, anzeigeName, schemaMitSaetzen, naechsteSortierung } from './calc'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'

function einheit(patch: Partial<TrainingSession>): TrainingSession {
  return {
    id: 'se1', day_id: 'd1', user_id: 'u1', week: 1,
    started_at: '2026-08-17T10:00:00.000Z', ended_at: '2026-08-17T11:00:00.000Z',
    minutes: 60, status: 'completed', paused_at: null,
    ...patch,
  }
}

function exercise(patch: Partial<Exercise>): Exercise {
  return { id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Bankdrücken', scheme: '4 × 5', rest: '2 min', note: null, bench_slot: null, muscle_group: null, sort_order: 0, library_id: null, ...patch }
}

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'p1', user_id: 'u1', name: 'TrainingsplanBench', typ: 'bench', week: 1,
    week_started_at: '2026-08-17T10:00:00.000Z', sort_order: 0,
    work: 80, reps: 5, rir: 2, plate: 2.5, block: 1, goal: null, goal_from: null,
    beruehrt: true, rpe: null, last_delta_note: null,
    created_at: '', updated_at: '',
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

describe('satzE1rm', () => {
  it('nutzt die RPE-Tabelle, wenn ein RPE-Wert vorliegt', () => {
    // 5 Wdh bei RPE 8 = 81 % laut Tabelle
    expect(satzE1rm(100, 5, 8)).toBeCloseTo(100 / 0.81, 1)
  })

  it('fällt ohne RPE auf Epley zurück', () => {
    expect(satzE1rm(100, 5, null)).toBeCloseTo(100 * (1 + 5 / 30), 1)
  })

  it('fällt außerhalb der RPE-Tabelle (z. B. 12 Wdh) auf Epley zurück', () => {
    expect(satzE1rm(100, 12, 8)).toBeCloseTo(100 * (1 + 12 / 30), 1)
  })

  it('liefert null ohne Gewicht oder Wiederholungen', () => {
    expect(satzE1rm(null, 5, null)).toBeNull()
    expect(satzE1rm(100, null, null)).toBeNull()
  })
})

describe('letzteEinheitFuerUebung', () => {
  it('liefert die Sätze der letzten Woche vor der aktuellen', () => {
    const saetze = [
      satz({ id: 'a', week: 1, position: 0, kg: 90 }),
      satz({ id: 'b', week: 1, position: 1, kg: 92 }),
      satz({ id: 'c', week: 2, position: 0, kg: 95 }),
    ]
    const ergebnis = letzteEinheitFuerUebung('ex1', saetze, 3)
    expect(ergebnis.map(s => s.id)).toEqual(['c'])
  })

  it('ignoriert Sätze der aktuellen Woche selbst', () => {
    const saetze = [satz({ id: 'a', week: 2, kg: 90 }), satz({ id: 'b', week: 3, kg: 95 })]
    expect(letzteEinheitFuerUebung('ex1', saetze, 3).map(s => s.id)).toEqual(['a'])
  })

  it('liefert eine leere Liste ohne vorige Woche', () => {
    expect(letzteEinheitFuerUebung('ex1', [satz({ week: 1 })], 1)).toEqual([])
  })
})

describe('muskelgruppenDesTags', () => {
  it('summiert Sätze je Muskelgruppe, absteigend sortiert', () => {
    const ex = [
      exercise({ id: 'e1', muscle_group: 'Brust', scheme: '4 × 5' }),
      exercise({ id: 'e2', muscle_group: 'Trizeps', scheme: '3 × 8' }),
      exercise({ id: 'e3', muscle_group: 'Brust', scheme: '3 × 8' }),
    ]
    expect(muskelgruppenDesTags(ex)).toEqual([
      { gruppe: 'Brust', saetze: 7 },
      { gruppe: 'Trizeps', saetze: 3 },
    ])
  })

  it('lässt Übungen ohne Muskelgruppe weg', () => {
    expect(muskelgruppenDesTags([exercise({ muscle_group: null })])).toEqual([])
  })
})

describe('wocheErledigt', () => {
  it('ist erledigt, wenn jeder Tag eine beendete Einheit hat', () => {
    const sessions = [einheit({ day_id: 'd1' }), einheit({ day_id: 'd2' }), einheit({ day_id: 'd3' })]
    expect(wocheErledigt(['d1', 'd2', 'd3'], sessions, 1)).toBe(true)
  })

  it('zählt übersprungene Tage als erledigt', () => {
    const sessions = [einheit({ day_id: 'd1' }), einheit({ day_id: 'd2', status: 'skipped' })]
    expect(wocheErledigt(['d1', 'd2'], sessions, 1)).toBe(true)
  })

  it('ist nicht erledigt, solange ein Tag fehlt', () => {
    expect(wocheErledigt(['d1', 'd2'], [einheit({ day_id: 'd1' })], 1)).toBe(false)
  })

  it('zählt eine noch laufende Einheit nicht als erledigt', () => {
    expect(wocheErledigt(['d1'], [einheit({ day_id: 'd1', ended_at: null })], 1)).toBe(false)
  })

  it('ignoriert Einheiten anderer Wochen', () => {
    expect(wocheErledigt(['d1'], [einheit({ day_id: 'd1', week: 1 })], 2)).toBe(false)
  })

  it('ist ohne Trainingstage nie erledigt', () => {
    expect(wocheErledigt([], [], 1)).toBe(false)
  })
})

describe('anzeigeName', () => {
  it('hängt "(Deload)" an, wenn Bankfokus-Plan, Woche 4 und Bank-Slot zusammentreffen', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Bankdrücken Langhantel (Deload)')
  })

  it('funktioniert unabhängig vom tatsächlichen Übungsnamen', () => {
    const ex = exercise({ name: 'Bankdrücken mit Pause', bench_slot: 'd3' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Bankdrücken mit Pause (Deload)')
  })

  it('lässt den Namen in anderen Wochen unverändert', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 1)).toBe('Bankdrücken Langhantel')
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 3)).toBe('Bankdrücken Langhantel')
  })

  it('lässt den Namen ohne Bank-Zuordnung unverändert, auch in Woche 4', () => {
    const ex = exercise({ name: 'Klimmzüge', bench_slot: null })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Klimmzüge')
  })

  it('lässt den Namen bei allgemeinen Plänen unverändert, auch in Woche 4', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'general' }), 4)).toBe('Bankdrücken Langhantel')
  })
})

describe('schemaMitSaetzen', () => {
  it('tauscht nur die Satzanzahl, der Rest bleibt', () => {
    expect(schemaMitSaetzen('4 × 8', 5)).toBe('5 × 8')
    expect(schemaMitSaetzen('3 × 10–12', 4)).toBe('4 × 10–12')
    expect(schemaMitSaetzen('3x10', 2)).toBe('2x10')
  })

  it('erzeugt ein sauberes Schema, wenn keins erkennbar ist', () => {
    expect(schemaMitSaetzen('', 3)).toBe('3 × 10')
    expect(schemaMitSaetzen(null, 4)).toBe('4 × 10')
  })
})

describe('naechsteSortierung', () => {
  it('liegt eins über der höchsten vergebenen Nummer', () => {
    expect(naechsteSortierung([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 2 }])).toBe(3)
  })

  // Der eigentliche Grund für die Funktion: nach einer Löschung ist die
  // Anzahl kleiner als die höchste Nummer und würde kollidieren.
  it('kollidiert nicht mit einer Lücke durch Löschen', () => {
    expect(naechsteSortierung([{ sort_order: 0 }, { sort_order: 2 }])).toBe(3)
  })

  it('beginnt bei 0, wenn noch nichts da ist', () => {
    expect(naechsteSortierung([])).toBe(0)
  })
})
