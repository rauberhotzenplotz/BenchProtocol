/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { netzLesen } from './koerper3dNetz'
import { REGIONEN } from './koerper3dModell'

/* Prüft die mitgelieferte Netzdatei selbst — wer das Modell ändert und
   vergisst, das Netz neu zu erzeugen, soll es hier merken. */

const datei = readFileSync(new URL('../../../public/modelle/koerper3d.bin', import.meta.url))
const netz = netzLesen(datei.buffer.slice(datei.byteOffset, datei.byteOffset + datei.byteLength))

describe('Netz des 3D-Körpermodells', () => {
  it('passt zur Regionenliste des Modells', () => {
    expect(netz.anzahlRegionen).toBe(REGIONEN.length)
  })

  it('enthält jede Region auf der Oberfläche', () => {
    const vorhanden = new Set(netz.regionen)
    REGIONEN.forEach((r, i) => expect(vorhanden.has(i), r).toBe(true))
  })

  it('hat gültige Indizes und Normalen der Länge 1', () => {
    const punkte = netz.positionen.length / 3
    expect(netz.indizes.length % 3).toBe(0)
    expect(netz.indizes.reduce((a, i) => Math.max(a, i), 0)).toBeLessThan(punkte)
    for (let i = 0; i < punkte; i += 97) {
      const l = Math.hypot(netz.normalen[i * 3], netz.normalen[i * 3 + 1], netz.normalen[i * 3 + 2])
      expect(l).toBeGreaterThan(0.95)
      expect(l).toBeLessThan(1.05)
    }
  })

  it('steht auf dem Boden und ist rund 1,75 m groß', () => {
    let unten = Infinity
    let oben = -Infinity
    for (let i = 1; i < netz.positionen.length; i += 3) {
      unten = Math.min(unten, netz.positionen[i])
      oben = Math.max(oben, netz.positionen[i])
    }
    expect(unten).toBeLessThan(0.02)
    expect(oben).toBeGreaterThan(1.7)
    expect(oben).toBeLessThan(1.8)
  })

  it('ist seitengleich: zu jedem Punkt gibt es einen gespiegelten', () => {
    // Stichprobe: Für jeden 200. Punkt einen Partner bei −x suchen.
    const punkte = netz.positionen.length / 3
    let ohnePartner = 0
    for (let i = 0; i < punkte; i += 200) {
      const [x, y, z] = [netz.positionen[i * 3], netz.positionen[i * 3 + 1], netz.positionen[i * 3 + 2]]
      let naechster = Infinity
      for (let j = 0; j < punkte; j++) {
        const d = Math.hypot(netz.positionen[j * 3] + x, netz.positionen[j * 3 + 1] - y, netz.positionen[j * 3 + 2] - z)
        if (d < naechster) naechster = d
      }
      if (naechster > 0.01) ohnePartner++
    }
    expect(ohnePartner).toBe(0)
  })
})
