import { describe, it, expect } from 'vitest'
import { woerter, besterTreffer } from './uebung-zuordnen.mjs'

/** Ausschnitt aus dem echten Katalog, mit den Rangwerten von dort. */
const KATALOG = [
  { id: 'k1', name: 'Langhantel Bankdrücken', popularity: 3 },
  { id: 'k2', name: 'Kurzhantel Bankdrücken', popularity: 103 },
  { id: 'k3', name: 'Langhantel Bankdrücken, mit Pause', popularity: 15 },
  { id: 'k4', name: 'Kurzhantel Bankdrücken, mit Pause', popularity: 115 },
  { id: 'k5', name: 'Klimmzugstange Klimmzug', popularity: 102 },
  { id: 'k6', name: 'Klimmzugmaschine unterstützt', popularity: 4 },
  { id: 'k7', name: 'Kurzhantel Schrägbankdrücken', popularity: 104 },
  { id: 'k8', name: 'T-Bar-Rudern', popularity: 1002 },
  { id: 'k9', name: 'Beinbeuger liegend', popularity: 3 },
  { id: 'k10', name: 'Beinbeuger sitzend', popularity: 3 },
  { id: 'k11', name: 'Kabelzug Crunch', popularity: 103 },
]

describe('woerter', () => {
  it('macht Umlaute, Klammern und Bindestriche vergleichbar', () => {
    expect(woerter('Seitheben Kabel  (A)')).toEqual(['seitheben', 'kabel'])
    expect(woerter('T-Bar Rudern')).toEqual(['t', 'bar', 'rudern'])
  })

  it('zieht Mehrzahl und gebeugte Formen auf eine Form zusammen', () => {
    expect(woerter('Klimmzüge')).toEqual(['klimmzug'])
    expect(woerter('Liegender Beinbeuger')).toEqual(['liegend', 'beinbeug'])
    expect(woerter('Sitzendes Wadenheben')).toEqual(['sitzend', 'wadenheben'])
  })

  it('vereinheitlicht englische und deutsche Geraetenamen', () => {
    expect(woerter('Cable Crunch')).toEqual(['kabel', 'crunch'])
    expect(woerter('Kabelzug Crunch')).toEqual(['kabel', 'crunch'])
  })
})

describe('besterTreffer', () => {
  it('findet trotz vertauschter Wortfolge', () => {
    expect(besterTreffer('Bankdrücken Langhantel', KATALOG)?.name).toBe('Langhantel Bankdrücken')
  })

  it('nimmt die knappste Variante, nicht die erstbeste', () => {
    // "Langhantel Bankdrücken, mit Pause" passt auch, hat aber ein Wort zu viel.
    expect(besterTreffer('Langhantel Bankdrücken', KATALOG)?.name).toBe('Langhantel Bankdrücken')
  })

  // Der Fehler, der beim ersten Lauf am Geraet auffiel: "Klimmzug" steckt
  // auch in "Klimmzugmaschine", und die hatte den besseren Rang.
  it('zieht ganze Woerter dem Wortteil vor', () => {
    expect(besterTreffer('Klimmzüge', KATALOG)?.name).toBe('Klimmzugstange Klimmzug')
  })

  // Umgekehrt muss der Wortteil greifen, wo Deutsch zusammenschreibt.
  it('kommt mit zusammengeschriebenen Bewegungen zurecht', () => {
    expect(besterTreffer('Schrägbank Kurzhantel-Drücken', KATALOG)?.name).toBe('Kurzhantel Schrägbankdrücken')
  })

  it('entscheidet Gleichstand ueber den Bekanntheitsrang', () => {
    // Langhantel und Kurzhantel passen gleich gut; der bekanntere gewinnt.
    expect(besterTreffer('Bankdrücken mit Pause', KATALOG)?.name).toBe('Langhantel Bankdrücken, mit Pause')
  })

  it('unterscheidet liegend und sitzend', () => {
    expect(besterTreffer('Liegender Beinbeuger', KATALOG)?.name).toBe('Beinbeuger liegend')
    expect(besterTreffer('Sitzender Beinbeuger', KATALOG)?.name).toBe('Beinbeuger sitzend')
  })

  // Im Zweifel nichts: Eine falsche Verknuepfung faerbt dauerhaft die
  // falschen Muskeln.
  it('ordnet nichts zu, wenn es keinen Treffer gibt', () => {
    expect(besterTreffer('V Squad', KATALOG)).toBeNull()
    expect(besterTreffer('', KATALOG)).toBeNull()
  })

  it('ordnet nichts zu, wenn zwei Kandidaten in allem gleich sind', () => {
    const zwilling = [
      { id: 'a', name: 'Beinbeuger liegend', popularity: 3 },
      { id: 'b', name: 'Beinbeuger stehend', popularity: 3 },
    ]
    expect(besterTreffer('Beinbeuger', zwilling)).toBeNull()
  })
})
