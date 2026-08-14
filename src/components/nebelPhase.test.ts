import { describe, it, expect } from 'vitest'
import { nebelPhase } from './nebelPhase'
import type { Plan } from '../types/db'

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'p1', user_id: 'u1', name: 'Test', typ: 'bench', week: 1, sort_order: 0,
    work: null, reps: null, rir: null, plate: 2.5, block: 1, goal: null, goal_from: null,
    beruehrt: true, rpe: null, last_delta_note: null, created_at: '', updated_at: '',
    ...patch,
  }
}

describe('nebelPhase', () => {
  it('hält die Wochen 1 und 2 im Grundton', () => {
    expect(nebelPhase(plan({ week: 1 }))).toBe('aufbau')
    expect(nebelPhase(plan({ week: 2 }))).toBe('aufbau')
  })

  it('erkennt Woche 3 als die schwerste', () => {
    expect(nebelPhase(plan({ week: 3 }))).toBe('schwer')
  })

  it('erkennt Woche 4 als Deload', () => {
    expect(nebelPhase(plan({ week: 4 }))).toBe('deload')
  })

  it('gibt Standardplänen keine Phase — dort gibt es keinen Blockrhythmus', () => {
    expect(nebelPhase(plan({ typ: 'general', week: 3 }))).toBe('aufbau')
    expect(nebelPhase(plan({ typ: 'general', week: 4 }))).toBe('aufbau')
  })

  it('kommt ohne Plan zurecht — der Nebel steht auch vor dem Anmelden', () => {
    expect(nebelPhase(null)).toBe('aufbau')
    expect(nebelPhase(undefined)).toBe('aufbau')
  })

  it('fällt bei Wochen jenseits des Blocks auf den Grundton zurück', () => {
    expect(nebelPhase(plan({ week: 5 }))).toBe('aufbau')
    expect(nebelPhase(plan({ week: 0 }))).toBe('aufbau')
  })
})
