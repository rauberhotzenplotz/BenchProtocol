import { describe, it, expect } from 'vitest'
import { formatGewicht, zahlenBereich } from './zahlen'

describe('formatGewicht', () => {
  it('schreibt deutsch mit Komma', () => {
    expect(formatGewicht(82.5)).toBe('82,5')
    expect(formatGewicht(112.5)).toBe('112,5')
  })

  // Der Anlass: Die Eingabe nimmt drei Nachkommastellen an, die Anzeige
  // rundete auf eine. Ein eingetragenes 82,125 stand als 82,1 da.
  it('zeigt bis zu drei Nachkommastellen', () => {
    expect(formatGewicht(82.125)).toBe('82,125')
    expect(formatGewicht(0.125)).toBe('0,125')
  })

  it('haengt keine ueberfluessigen Nullen an', () => {
    expect(formatGewicht(80)).toBe('80')
    expect(formatGewicht(80.1)).toBe('80,1')
  })

  it('rundet jenseits der dritten Stelle', () => {
    expect(formatGewicht(1 / 3)).toBe('0,333')
  })
})

describe('zahlenBereich', () => {
  it('trifft die uebliche Scheibengroesse genau', () => {
    expect(zahlenBereich(2.5, 10, 2.5)).toEqual([2.5, 5, 7.5, 10])
  })

  // Auf Tausendstel gerundet, seit die Eingabe drei Nachkommastellen
  // erlaubt: Mit Hundertsteln wurde aus 0,125er-Schritten 0,13 / 0,25.
  it('haelt Mikro-Scheiben sauber', () => {
    expect(zahlenBereich(0.125, 0.5, 0.125)).toEqual([0.125, 0.25, 0.375, 0.5])
  })

  it('bleibt frei von Gleitkomma-Schmutz', () => {
    expect(zahlenBereich(0.1, 0.5, 0.1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
  })
})
