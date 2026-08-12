import { describe, it, expect } from 'vitest'
import { planeWochen } from './blockPlanung'

describe('planeWochen', () => {
  it('hält die Zielwiederholungen über alle Wochen konstant', () => {
    const wochen = planeWochen({ plannedWeeks: 4, targetReps: 5, startRpe: 7, rpeSchritt: 0.5, plate: 2.5, startE1rm: null })
    expect(wochen.every(w => w.targetReps === 5)).toBe(true)
    expect(wochen.map(w => w.weekNumber)).toEqual([1, 2, 3, 4])
  })

  it('lässt den RPE linear steigen', () => {
    const wochen = planeWochen({ plannedWeeks: 4, targetReps: 5, startRpe: 7, rpeSchritt: 0.5, plate: 2.5, startE1rm: null })
    expect(wochen.map(w => w.targetRpe)).toEqual([7, 7.5, 8, 8.5])
  })

  it('deckelt den RPE bei 10', () => {
    const wochen = planeWochen({ plannedWeeks: 6, targetReps: 5, startRpe: 9, rpeSchritt: 1, plate: 2.5, startE1rm: null })
    expect(wochen.map(w => w.targetRpe)).toEqual([9, 10, 10, 10, 10, 10])
  })

  it('lässt targetWeight leer ohne bekanntes Start-1RM', () => {
    const wochen = planeWochen({ plannedWeeks: 2, targetReps: 5, startRpe: 7, rpeSchritt: 0.5, plate: 2.5, startE1rm: null })
    expect(wochen.every(w => w.targetWeight == null)).toBe(true)
  })

  it('rechnet targetWeight aus einem bekannten Start-1RM zurück', () => {
    const wochen = planeWochen({ plannedWeeks: 1, targetReps: 5, startRpe: 8, rpeSchritt: 0.5, plate: 2.5, startE1rm: 123.4568 })
    // prozentsatz(5, 8) = 0.81 -> 123.4568 * 0.81 = 100.0 (abgerundet auf 2.5er-Stufe)
    expect(wochen[0].targetWeight).toBe(100)
  })
})
