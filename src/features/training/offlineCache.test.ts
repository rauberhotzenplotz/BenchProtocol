import { describe, it, expect } from 'vitest'
import {
  upsertInArray,
  removeFromArray,
  arrayContainsId,
  buildOptimisticSession,
  upsertSessionInArray,
  matchesExerciseWeek,
  matchesDayWeek,
} from './offlineCache'
import type { LoggedSet, TrainingSession } from '../../types/db'

function set(patch: Partial<LoggedSet>): LoggedSet {
  return { id: 's', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0, kg: null, reps: null, rpe: null, done: false, done_at: null, rpe_block_id: null, created_at: '', ...patch }
}

function session(patch: Partial<TrainingSession>): TrainingSession {
  return { id: 'se1', day_id: 'd1', user_id: 'u1', week: 1, started_at: '', ended_at: null, minutes: null, status: 'completed', ...patch }
}

describe('upsertInArray', () => {
  it('ersetzt einen bestehenden Satz an gleicher Position', () => {
    const alt = [set({ id: 's1', position: 0, kg: 60 })]
    const neu = upsertInArray(alt, { exercise_id: 'ex1', week: 1, position: 0, kg: 65 })
    expect(neu).toHaveLength(1)
    expect(neu[0].id).toBe('s1')
    expect(neu[0].kg).toBe(65)
  })

  it('hängt einen neuen optimistischen Satz an, wenn keiner passt', () => {
    const neu = upsertInArray([], { exercise_id: 'ex1', week: 1, position: 0, kg: 60, reps: 5 })
    expect(neu).toHaveLength(1)
    expect(neu[0].kg).toBe(60)
    expect(neu[0].reps).toBe(5)
    expect(neu[0].id).toBeTruthy()
  })

  it('lässt Felder unangetastet, die im Patch fehlen', () => {
    const alt = [set({ id: 's1', position: 0, kg: 60, reps: 5 })]
    const neu = upsertInArray(alt, { exercise_id: 'ex1', week: 1, position: 0, done: true })
    expect(neu[0].kg).toBe(60)
    expect(neu[0].reps).toBe(5)
    expect(neu[0].done).toBe(true)
  })

  it('unterscheidet nach Woche und Position', () => {
    const alt = [set({ id: 's1', week: 1, position: 0 })]
    const neu = upsertInArray(alt, { exercise_id: 'ex1', week: 2, position: 0, kg: 70 })
    expect(neu).toHaveLength(2)
  })
})

describe('removeFromArray / arrayContainsId', () => {
  it('entfernt den passenden Satz', () => {
    const alt = [set({ id: 's1' }), set({ id: 's2' })]
    expect(removeFromArray(alt, 's1')).toEqual([set({ id: 's2' })])
  })

  it('arrayContainsId findet vorhandene ids', () => {
    const alt = [set({ id: 's1' })]
    expect(arrayContainsId(alt, 's1')).toBe(true)
    expect(arrayContainsId(alt, 'unbekannt')).toBe(false)
  })
})

describe('buildOptimisticSession', () => {
  it('legt eine neue Session mit Defaults an, wenn keine existiert', () => {
    const s = buildOptimisticSession(null, { day_id: 'd1', week: 1, status: 'completed' })
    expect(s.day_id).toBe('d1')
    expect(s.week).toBe(1)
    expect(s.status).toBe('completed')
    expect(s.ended_at).toBeNull()
  })

  it('übernimmt bestehende Felder und überschreibt nur den Patch', () => {
    const alt = session({ id: 'se1', started_at: '2026-01-01T00:00:00.000Z' })
    const s = buildOptimisticSession(alt, { day_id: 'd1', week: 1, ended_at: '2026-01-01T01:00:00.000Z', minutes: 60 })
    expect(s.id).toBe('se1')
    expect(s.started_at).toBe('2026-01-01T00:00:00.000Z')
    expect(s.ended_at).toBe('2026-01-01T01:00:00.000Z')
    expect(s.minutes).toBe(60)
  })
})

describe('upsertSessionInArray', () => {
  it('ersetzt eine bestehende Session gleichen Tags/Woche', () => {
    const alt = [session({ id: 'se1', day_id: 'd1', week: 1 })]
    const neu = upsertSessionInArray(alt, session({ id: 'se1', day_id: 'd1', week: 1, status: 'skipped' }))
    expect(neu).toHaveLength(1)
    expect(neu[0].status).toBe('skipped')
  })

  it('hängt eine neue Session an, wenn keine passt', () => {
    const neu = upsertSessionInArray([], session({ day_id: 'd2', week: 1 }))
    expect(neu).toHaveLength(1)
  })
})

describe('matchesExerciseWeek / matchesDayWeek', () => {
  it('matchesExerciseWeek prüft Woche und Übungs-id', () => {
    expect(matchesExerciseWeek(['ex1', 'ex2'], 1, 'ex1', 1)).toBe(true)
    expect(matchesExerciseWeek(['ex1'], 1, 'ex1', 2)).toBe(false)
    expect(matchesExerciseWeek(['ex1'], 1, 'ex2', 1)).toBe(false)
  })

  it('matchesDayWeek prüft Woche und Tag-id', () => {
    expect(matchesDayWeek(['d1', 'd2'], 1, 'd1', 1)).toBe(true)
    expect(matchesDayWeek(['d1'], 1, 'd1', 2)).toBe(false)
  })
})
