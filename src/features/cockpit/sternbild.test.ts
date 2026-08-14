import { describe, it, expect } from 'vitest'
import { sternbild } from './sternbild'
import type { EinheitPunkt } from './calc'

const TAG = 864e5

function punkt(patch: Partial<EinheitPunkt>): EinheitPunkt {
  return {
    sessionId: 's1', datumLabel: '01.01.', zeit: 0, wochenLabel: 'W1', tagName: 'Tag 1',
    minuten: 60, tonnage: 1000, erledigt: 4, geplant: 4, farbe: '#35F0D0',
    ...patch,
  }
}

describe('sternbild', () => {
  it('verteilt die Sterne nach echtem Kalenderabstand, nicht nach Reihenfolge', () => {
    // Zwei Einheiten dicht beieinander, dann eine Woche Pause.
    const sterne = sternbild([
      punkt({ zeit: 0 }),
      punkt({ zeit: TAG }),
      punkt({ zeit: 8 * TAG }),
    ])
    expect(sterne.map(s => +s.x.toFixed(3))).toEqual([0, 0.125, 1])
    // Die Lücke nach der zweiten Einheit ist deutlich größer als die davor.
    expect(sterne[2].x - sterne[1].x).toBeGreaterThan((sterne[1].x - sterne[0].x) * 5)
  })

  it('misst die Höhe gegen 0, damit ähnliche Einheiten eine ruhige Kette bilden', () => {
    const sterne = sternbild([
      punkt({ zeit: 0, tonnage: 1000 }),
      punkt({ zeit: TAG, tonnage: 1100 }),
      punkt({ zeit: 2 * TAG, tonnage: 1050 }),
    ])
    const ys = sterne.map(s => s.y)
    // Alle im oberen Bereich und nah beieinander — kein Zickzack.
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.12)
  })

  it('setzt die stärkste Einheit ganz nach oben', () => {
    const sterne = sternbild([
      punkt({ zeit: 0, tonnage: 500 }),
      punkt({ zeit: TAG, tonnage: 2000 }),
    ])
    expect(sterne[1].y).toBe(0)
    expect(sterne[0].y).toBe(0.75)
  })

  it('leitet die Größe aus den abgehakten Sätzen ab', () => {
    const sterne = sternbild([
      punkt({ zeit: 0, erledigt: 2 }),
      punkt({ zeit: TAG, erledigt: 8 }),
    ])
    expect(sterne[0].groesse).toBe(0.25)
    expect(sterne[1].groesse).toBe(1)
  })

  it('stellt eine einzelne Einheit in die Mitte statt an den Rand', () => {
    const sterne = sternbild([punkt({ zeit: 12345 })])
    expect(sterne).toHaveLength(1)
    expect(sterne[0].x).toBe(0.5)
  })

  it('kommt mit mehreren Einheiten am selben Zeitpunkt zurecht', () => {
    const sterne = sternbild([punkt({ zeit: 500 }), punkt({ zeit: 500 })])
    expect(sterne.every(s => s.x === 0.5)).toBe(true)
  })

  it('bleibt bei lauter Nullwerten in gültigen Grenzen statt durch 0 zu teilen', () => {
    const sterne = sternbild([
      punkt({ zeit: 0, tonnage: 0, erledigt: 0 }),
      punkt({ zeit: TAG, tonnage: 0, erledigt: 0 }),
    ])
    for (const s of sterne) {
      expect(Number.isFinite(s.y)).toBe(true)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(1)
      expect(s.groesse).toBe(0)
    }
  })

  it('liefert für keine Einheiten eine leere Liste', () => {
    expect(sternbild([])).toEqual([])
  })
})
