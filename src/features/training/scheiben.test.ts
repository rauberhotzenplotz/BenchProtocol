import { describe, it, expect } from 'vitest'
import { beladung, beladungText } from './scheiben'

describe('beladung', () => {
  it('legt je Seite die wenigsten Scheiben auf', () => {
    expect(beladung(100)).toEqual({ stange: 20, jeSeite: [25, 15], rest: 0 })
  })
  it('trifft auch Viertelkilo-Schritte ohne Rundungsfehler', () => {
    expect(beladung(62.5)).toEqual({ stange: 20, jeSeite: [20, 1.25], rest: 0 })
    expect(beladung(82.5)).toEqual({ stange: 20, jeSeite: [25, 5, 1.25], rest: 0 })
  })
  it('meldet, was sich nicht auflegen lässt', () => {
    expect(beladung(21)).toEqual({ stange: 20, jeSeite: [], rest: 1 })
    // 0,625 kg je Seite — mit 1,25er-Scheiben nicht zu machen.
    expect(beladung(61.25)).toEqual({ stange: 20, jeSeite: [20], rest: 1.25 })
  })
  it('gibt bei genau dem Stangengewicht eine leere Seite', () => {
    expect(beladung(20)).toEqual({ stange: 20, jeSeite: [], rest: 0 })
  })
  it('rechnet mit einer anderen Stange', () => {
    expect(beladung(30, 10)).toEqual({ stange: 10, jeSeite: [10], rest: 0 })
  })
  it('gibt null unterhalb des Stangengewichts', () => {
    expect(beladung(15)).toBeNull()
    expect(beladung(NaN)).toBeNull()
  })
  it('nimmt einen eigenen Scheibensatz', () => {
    expect(beladung(60, 20, [10, 5])).toEqual({ stange: 20, jeSeite: [10, 10], rest: 0 })
  })
})

describe('beladungText', () => {
  it('fasst gleiche Scheiben zusammen und schreibt deutsch', () => {
    expect(beladungText({ stange: 20, jeSeite: [20, 20, 5, 1.25], rest: 0 })).toBe('2 × 20 · 5 · 1,25')
  })
  it('sagt "nur Stange" ohne Scheiben', () => {
    expect(beladungText({ stange: 20, jeSeite: [], rest: 0 })).toBe('nur Stange')
  })
})
