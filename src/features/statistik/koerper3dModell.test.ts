import { describe, it, expect } from 'vitest'
import { GRUNDKOERPER, MUSKELN, REGION_NAMEN, type Form, type Vec3 } from './koerper3dModell'
import { VORDERSEITE, RUECKSEITE } from './koerperModell'

/** Liegt ein Punkt im Grundkörper? Achsenparallele Ellipsoide und
    Kapseln — mehr Formen hat der Grundkörper nicht. */
function imKoerper(p: Vec3): boolean {
  return GRUNDKOERPER.some((f: Form) => {
    if (f.art === 'ellipsoid') {
      const [mx, my, mz] = f.mitte!
      const [rx, ry, rz] = f.radien!
      return ((p[0] - mx) / rx) ** 2 + ((p[1] - my) / ry) ** 2 + ((p[2] - mz) / rz) ** 2 < 1
    }
    const a = f.a!
    const b = f.b!
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)))
    const n = [a[0] + ab[0] * t - p[0], a[1] + ab[1] * t - p[1], a[2] + ab[2] * t - p[2]]
    return Math.hypot(n[0], n[1], n[2]) < f.radius!
  })
}

const OHNE_DATEN = new Set(['head', 'neck', 'knees'])

describe('3D-Körpermodell', () => {
  it('hat für jede eingefärbte Region des flachen Modells eine Form', () => {
    const regionen = new Set(MUSKELN.map(m => m.region))
    const flach = new Set([...Object.keys(VORDERSEITE), ...Object.keys(RUECKSEITE)].filter(k => !OHNE_DATEN.has(k)))
    for (const r of flach) expect(regionen.has(r), r).toBe(true)
  })

  it('kennt für jede Region einen deutschen Namen', () => {
    for (const m of MUSKELN) expect(REGION_NAMEN[m.region], m.region).toBeTruthy()
  })

  it('legt paarige Muskeln spiegelgleich auf beide Seiten', () => {
    const seitlich = MUSKELN.filter(m => Math.abs(m.mitte![0]) > 1e-9)
    for (const m of seitlich) {
      // Die beiden Schollenmuskeln heißen je Seite anders, sind aber trotzdem ein Paar.
      const partnerName = m.region.startsWith('left-')
        ? m.region.replace(/^left-/, 'right-')
        : m.region.startsWith('right-')
          ? m.region.replace(/^right-/, 'left-')
          : m.region
      const partner = MUSKELN.find(
        n => n.region === partnerName && Math.abs(n.mitte![0] + m.mitte![0]) < 1e-9 && Math.abs(n.mitte![1] - m.mitte![1]) < 1e-9,
      )
      expect(partner, `${m.region} bei x=${m.mitte![0]}`).toBeTruthy()
    }
  })

  it('lässt jeden Muskel ein Stück aus dem Körper ragen, damit er sichtbar bleibt', () => {
    for (const m of MUSKELN) {
      const [x, y, z] = m.mitte!
      const [rx, ry, rz] = m.radien!
      // Die äußersten Punkte entlang der Achsen — mindestens einer muss
      // außerhalb des Grundkörpers liegen.
      const extreme: Vec3[] = [
        [x + rx * 0.9, y, z],
        [x - rx * 0.9, y, z],
        [x, y + ry * 0.9, z],
        [x, y - ry * 0.9, z],
        [x, y, z + rz * 0.9],
        [x, y, z - rz * 0.9],
      ]
      expect(extreme.some(p => !imKoerper(p)), `${m.region} bei ${m.mitte!.join('/')}`).toBe(true)
    }
  })

  it('stellt den Körper auf den Boden, rund 1,75 m groß', () => {
    const unten = Math.min(...GRUNDKOERPER.map(f => (f.mitte ? f.mitte[1] - f.radien![1] : Math.min(f.a![1], f.b![1]) - f.radius!)))
    const oben = Math.max(...GRUNDKOERPER.map(f => (f.mitte ? f.mitte[1] + f.radien![1] : Math.max(f.a![1], f.b![1]) + f.radius!)))
    expect(unten).toBeCloseTo(0.01, 1)
    expect(oben).toBeGreaterThan(1.7)
    expect(oben).toBeLessThan(1.8)
  })
})
