import { describe, it, expect } from 'vitest'
import { topSatzDerWoche, blockAuswertung, empfehlung, type WochenEintrag, type BlockAuswertung } from './blockAuswertung'

describe('topSatzDerWoche', () => {
  it('wählt den Satz mit dem höchsten e1RM', () => {
    const top = topSatzDerWoche([
      { gewicht: 100, wdh: 5, rpe: 8 }, // e1RM ≈ 123.5
      { gewicht: 120, wdh: 3, rpe: 9 }, // e1RM ≈ 134.8
      { gewicht: 80, wdh: 8, rpe: 7 }, // e1RM ≈ 111.1
    ])
    expect(top).toEqual({ gewicht: 120, wdh: 3, rpe: 9 })
  })

  it('ignoriert Sätze ohne RPE', () => {
    const top = topSatzDerWoche([
      { gewicht: 200, wdh: 5, rpe: null },
      { gewicht: 100, wdh: 5, rpe: 8 },
    ])
    expect(top).toEqual({ gewicht: 100, wdh: 5, rpe: 8 })
  })

  it('ignoriert Sätze außerhalb der RPE-Tabelle', () => {
    const top = topSatzDerWoche([
      { gewicht: 300, wdh: 12, rpe: 8 }, // Wdh > 8, nicht auswertbar
      { gewicht: 100, wdh: 5, rpe: 8 },
    ])
    expect(top).toEqual({ gewicht: 100, wdh: 5, rpe: 8 })
  })

  it('gibt null zurück, wenn kein Satz auswertbar ist', () => {
    expect(topSatzDerWoche([{ gewicht: 100, wdh: 5, rpe: null }])).toBeNull()
    expect(topSatzDerWoche([])).toBeNull()
  })
})

describe('blockAuswertung', () => {
  const wochen: WochenEintrag[] = [
    { woche: 1, topSatz: { gewicht: 100, wdh: 5, rpe: 8 }, geplanterRpe: 8 }, // e1RM 123.46
    { woche: 2, topSatz: { gewicht: 102.5, wdh: 5, rpe: 8 }, geplanterRpe: 8 }, // e1RM 126.54
    { woche: 3, topSatz: { gewicht: 105, wdh: 5, rpe: 9 }, geplanterRpe: 8 }, // e1RM 125.0, RPE-Drift +1
    { woche: 4, topSatz: { gewicht: 107.5, wdh: 5, rpe: 8 }, geplanterRpe: 8 }, // e1RM 132.72 (Best)
  ]

  it('berechnet Start-, Best-e1RM und deltaPercent', () => {
    const a = blockAuswertung(wochen)
    expect(a.blockStartE1RM).toBeCloseTo(123.4568, 3)
    expect(a.blockBestE1RM).toBeCloseTo(132.716, 3)
    expect(a.deltaPercent).toBeCloseTo(7.5, 1)
    expect(a.gueltigeWochen).toBe(4)
  })

  it('mittelt die RPE-Drift nur über Wochen mit geplantem RPE', () => {
    const a = blockAuswertung(wochen)
    // Wochen 1,2,4: Drift 0; Woche 3: Drift +1 -> Schnitt 0.25
    expect(a.rpeDrift).toBeCloseTo(0.25, 3)
  })

  it('lässt Wochen ohne geplanten RPE bei der Drift außen vor', () => {
    const ohnePlan: WochenEintrag[] = [
      { woche: 1, topSatz: { gewicht: 100, wdh: 5, rpe: 8 }, geplanterRpe: null },
      { woche: 2, topSatz: { gewicht: 100, wdh: 5, rpe: 9 }, geplanterRpe: 8 },
    ]
    const a = blockAuswertung(ohnePlan)
    expect(a.rpeDrift).toBeCloseTo(1, 5) // nur Woche 2 zählt: 9 - 8 = 1
  })

  it('blockStartE1RM ist null ohne gültigen Satz in Woche 1', () => {
    const a = blockAuswertung([
      { woche: 1, topSatz: null, geplanterRpe: 8 },
      { woche: 2, topSatz: { gewicht: 100, wdh: 5, rpe: 8 }, geplanterRpe: 8 },
    ])
    expect(a.blockStartE1RM).toBeNull()
    expect(a.deltaPercent).toBeNull() // ohne Start kein Delta
    expect(a.blockBestE1RM).not.toBeNull() // Woche 2 bleibt gültig
  })

  it('alles null/0 ganz ohne gültige Wochen', () => {
    const a = blockAuswertung([
      { woche: 1, topSatz: null, geplanterRpe: 8 },
      { woche: 2, topSatz: null, geplanterRpe: 8 },
    ])
    expect(a).toEqual({ blockStartE1RM: null, blockBestE1RM: null, deltaPercent: null, rpeDrift: null, gueltigeWochen: 0 })
  })
})

describe('empfehlung', () => {
  const basis: BlockAuswertung = { blockStartE1RM: 100, blockBestE1RM: 105, deltaPercent: 5, rpeDrift: 0, gueltigeWochen: 4 }

  it('PROGRESS: deltaPercent >= 2 und rpeDrift <= 0.5', () => {
    expect(empfehlung(basis).typ).toBe('PROGRESS')
    expect(empfehlung({ ...basis, deltaPercent: 2.0, rpeDrift: 0.5 }).typ).toBe('PROGRESS') // Randwerte
  })

  it('ADD_STIMULUS: deltaPercent < 2 und rpeDrift <= 0.5', () => {
    const e = empfehlung({ ...basis, deltaPercent: 1.9, rpeDrift: 0.3 })
    expect(e.typ).toBe('ADD_STIMULUS')
    expect(e.begruendung).toContain('1.9')
  })

  it('REDUCE_FATIGUE: rpeDrift > 0.5, unabhängig von deltaPercent', () => {
    expect(empfehlung({ ...basis, deltaPercent: 10, rpeDrift: 0.6 }).typ).toBe('REDUCE_FATIGUE')
    expect(empfehlung({ ...basis, deltaPercent: -5, rpeDrift: 0.6 }).typ).toBe('REDUCE_FATIGUE')
  })

  it('INSUFFICIENT_DATA: weniger als 3 gültige Wochen', () => {
    const e = empfehlung({ ...basis, gueltigeWochen: 2 })
    expect(e.typ).toBe('INSUFFICIENT_DATA')
    expect(e.begruendung).toContain('2')
  })

  it('INSUFFICIENT_DATA auch bei fehlenden Kennzahlen trotz genug Wochen', () => {
    expect(empfehlung({ ...basis, deltaPercent: null }).typ).toBe('INSUFFICIENT_DATA')
    expect(empfehlung({ ...basis, rpeDrift: null }).typ).toBe('INSUFFICIENT_DATA')
  })

  it('jede Empfehlung liefert eine nicht-leere Begründung mit den konkreten Zahlen', () => {
    const faelle: BlockAuswertung[] = [
      { ...basis, deltaPercent: 5, rpeDrift: 0 }, // PROGRESS
      { ...basis, deltaPercent: 1, rpeDrift: 0 }, // ADD_STIMULUS
      { ...basis, deltaPercent: 5, rpeDrift: 1 }, // REDUCE_FATIGUE
      { ...basis, gueltigeWochen: 1 }, // INSUFFICIENT_DATA
    ]
    faelle.forEach(fall => {
      const e = empfehlung(fall)
      expect(e.begruendung.length).toBeGreaterThan(10)
    })
  })
})
