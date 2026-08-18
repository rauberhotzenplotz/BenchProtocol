import { describe, it, expect } from 'vitest'
import { inListeAnhaengen, inListeErsetzen, ausListeEntfernen } from './cache'

interface Zeile {
  id: string
  name: string
  sort_order?: number
}

const liste: Zeile[] = [
  { id: 'a', name: 'Erste' },
  { id: 'b', name: 'Zweite' },
]

describe('inListeAnhaengen', () => {
  it('hängt hinten an', () => {
    expect(inListeAnhaengen(liste, { id: 'c', name: 'Dritte' }).map(z => z.id)).toEqual(['a', 'b', 'c'])
  })

  it('kommt mit einem leeren Cache klar', () => {
    expect(inListeAnhaengen(undefined, { id: 'a', name: 'Erste' })).toHaveLength(1)
  })

  it('lässt die Ausgangsliste unangetastet', () => {
    inListeAnhaengen(liste, { id: 'c', name: 'Dritte' })
    expect(liste).toHaveLength(2)
  })
})

describe('inListeErsetzen', () => {
  it('ändert nur die passende Zeile und nur die genannten Felder', () => {
    const neu = inListeErsetzen(liste, 'b', { name: 'Geändert' })
    expect(neu[0]).toEqual({ id: 'a', name: 'Erste' })
    expect(neu[1]).toEqual({ id: 'b', name: 'Geändert' })
  })

  it('tut nichts, wenn die id nicht vorkommt', () => {
    expect(inListeErsetzen(liste, 'unbekannt', { name: 'X' })).toEqual(liste)
  })

  it('kommt mit einem leeren Cache klar', () => {
    expect(inListeErsetzen<Zeile>(undefined, 'a', { name: 'X' })).toEqual([])
  })
})

describe('ausListeEntfernen', () => {
  it('entfernt die passende Zeile', () => {
    expect(ausListeEntfernen(liste, 'a').map(z => z.id)).toEqual(['b'])
  })

  it('tut nichts, wenn die id nicht vorkommt', () => {
    expect(ausListeEntfernen(liste, 'unbekannt')).toEqual(liste)
  })

  it('kommt mit einem leeren Cache klar', () => {
    expect(ausListeEntfernen<Zeile>(undefined, 'a')).toEqual([])
  })
})
