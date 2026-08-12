import { describe, it, expect } from 'vitest'
import { prozentsatz, geschaetztes1RM, zielgewicht } from './e1rm'

describe('prozentsatz', () => {
  it('liest exakte Tabellenwerte', () => {
    expect(prozentsatz(1, 10)).toBe(1)
    expect(prozentsatz(5, 8)).toBe(0.81)
    expect(prozentsatz(8, 7)).toBe(0.72)
  })

  it('unterstützt halbe RPE-Werte', () => {
    expect(prozentsatz(5, 7.5)).toBe(0.8)
    expect(prozentsatz(3, 8.5)).toBe(0.88)
  })

  it('gibt null zurück für Wdh > 8', () => {
    expect(prozentsatz(9, 8)).toBeNull()
    expect(prozentsatz(12, 10)).toBeNull()
  })

  it('gibt null zurück für RPE < 6', () => {
    expect(prozentsatz(5, 5.5)).toBeNull()
    expect(prozentsatz(3, 4)).toBeNull()
  })

  it('interpoliert nicht zwischen Tabellenwerten', () => {
    expect(prozentsatz(5, 7.25)).toBeNull()
  })
})

describe('geschaetztes1RM', () => {
  it('berechnet e1RM aus Gewicht/Wdh/RPE', () => {
    // 100kg x 5 @RPE8 => 81% des 1RM => 1RM = 100 / 0.81
    expect(geschaetztes1RM(100, 5, 8)).toBeCloseTo(123.4568, 3)
  })

  it('wirft nicht, sondern gibt null zurück bei Wdh > 8', () => {
    expect(() => geschaetztes1RM(100, 10, 8)).not.toThrow()
    expect(geschaetztes1RM(100, 10, 8)).toBeNull()
  })

  it('wirft nicht, sondern gibt null zurück bei RPE < 6', () => {
    expect(() => geschaetztes1RM(100, 5, 5)).not.toThrow()
    expect(geschaetztes1RM(100, 5, 5)).toBeNull()
  })

  it('gibt null zurück bei nicht-positivem Gewicht', () => {
    expect(geschaetztes1RM(0, 5, 8)).toBeNull()
    expect(geschaetztes1RM(-10, 5, 8)).toBeNull()
  })
})

describe('zielgewicht', () => {
  it('rechnet vom 1RM zurück und rundet auf die Inkrementierung ab', () => {
    // 1RM 123.4568 * 81% (5@RPE8) = 100.0 -> exakt auf der Stufe
    expect(zielgewicht(123.4568, 5, 8, 2.5)).toBe(100)
  })

  it('rundet immer ab, nie auf', () => {
    // 1RM 100 * 89% (4@RPE10) = 89 -> nächste 2.5er-Stufe abwärts ist 87.5
    expect(zielgewicht(100, 4, 10, 2.5)).toBe(87.5)
  })

  it('respektiert eine andere Inkrementierung', () => {
    expect(zielgewicht(100, 4, 10, 5)).toBe(85)
    expect(zielgewicht(100, 4, 10, 1)).toBe(89)
  })

  it('gibt null zurück, wenn (Wdh, RPE) außerhalb der Tabelle liegt', () => {
    expect(zielgewicht(100, 9, 8)).toBeNull()
  })
})
