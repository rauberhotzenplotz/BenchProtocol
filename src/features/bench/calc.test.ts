import { describe, it, expect } from 'vitest'
import { baseE1RM, naechstesE1rm } from './calc'
import type { Exercise, LoggedSet, Plan } from '../../types/db'

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'p1',
    user_id: 'u1',
    name: 'Test',
    typ: 'bench',
    week: 1,
    sort_order: 0,
    work: null,
    reps: null,
    rir: null,
    plate: 2.5,
    block: 1,
    goal: null,
    goal_from: null,
    beruehrt: true,
    rpe: null,
    last_delta_note: null,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

function exercise(patch: Partial<Exercise>): Exercise {
  return { id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Bankdrücken', scheme: '4 × 5', rest: '2 min', note: null, bench_slot: null, sort_order: 0, ...patch }
}

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return { id: 's', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0, kg: null, reps: null, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '', ...patch }
}

describe('baseE1RM', () => {
  it('nutzt Epley, wenn kein RPE-Testsatz hinterlegt ist', () => {
    const e1 = baseE1RM(plan({ work: 100, reps: 5, rir: 2 }))
    expect(e1).toBeCloseTo(100 * (1 + 7 / 30), 1)
  })

  it('nutzt die RPE-Tabelle, wenn plan.rpe gesetzt ist', () => {
    const e1 = baseE1RM(plan({ work: 100, reps: 5, rpe: 8, rir: 2 }))
    // prozentsatz(5, 8) = 0.81 -> 100 / 0.81 = 123.4568…, gerundet auf 1 Nachkommastelle
    expect(e1).toBeCloseTo(123.5, 1)
  })

  it('fällt auf Epley zurück, wenn (Wdh, RPE) außerhalb der Tabelle liegt', () => {
    const e1 = baseE1RM(plan({ work: 100, reps: 10, rpe: 8, rir: 2 }))
    expect(e1).toBeCloseTo(100 * (1 + 12 / 30), 1)
  })
})

describe('naechstesE1rm', () => {
  const bankUebung = exercise({ bench_slot: 'd1' })

  it('gibt null zurück ohne "Bank schwer"-Übung', () => {
    const ergebnis = naechstesE1rm([exercise({ bench_slot: null })], [])
    expect(ergebnis.neuesE1rm).toBeNull()
  })

  it('übernimmt das gemessene Bestwert-1RM bei Fortschritt (PROGRESS)', () => {
    const saetze: LoggedSet[] = [
      satz({ week: 1, kg: 100, reps: 5, rpe: 7 }), // e1RM 126.6
      satz({ week: 2, kg: 102.5, reps: 5, rpe: 8 }), // e1RM 126.5
      satz({ week: 3, kg: 108, reps: 5, rpe: 8.5 }), // e1RM 130.1 (Best)
    ]
    const ergebnis = naechstesE1rm([bankUebung], saetze)
    expect(ergebnis.neuesE1rm).not.toBeNull()
    expect(ergebnis.neuesE1rm as number).toBeGreaterThan(126)
  })

  it('lässt das 1RM unverändert, wenn Wochen fehlen (INSUFFICIENT_DATA)', () => {
    const saetze: LoggedSet[] = [satz({ week: 1, kg: 100, reps: 5, rpe: 7 })]
    const ergebnis = naechstesE1rm([bankUebung], saetze)
    // Woche 1 ist der einzige gültige Wert -> blockStartE1RM = blockBestE1RM,
    // aber gueltigeWochen < 3 -> INSUFFICIENT_DATA -> neuesE1rm = blockStartE1RM
    expect(ergebnis.neuesE1rm).toBeCloseTo(126.582, 2)
    expect(ergebnis.begruendung).toContain('3')
  })

  it('lässt das 1RM unverändert bei hoher RPE-Drift (REDUCE_FATIGUE)', () => {
    const saetze: LoggedSet[] = [
      satz({ week: 1, kg: 100, reps: 5, rpe: 7 }), // planmäßig
      satz({ week: 2, kg: 102.5, reps: 5, rpe: 9.5 }), // weit über Ziel-RPE 8
      satz({ week: 3, kg: 105, reps: 5, rpe: 10 }), // weit über Ziel-RPE 8.5
    ]
    const ergebnis = naechstesE1rm([bankUebung], saetze)
    const startE1rm = 100 / 0.79 // prozentsatz(5,7)
    expect(ergebnis.neuesE1rm).toBeCloseTo(startE1rm, 1)
  })
})
