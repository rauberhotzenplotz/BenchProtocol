import { describe, it, expect } from 'vitest'
import { ketteFuer, druckZugBilanz } from './druckZug'

/** Baut die Tabelle nach, die volume/calc.ts liefert: Gruppe → Tag → Sätze. */
function tabelle(eintraege: Record<string, number>): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>()
  for (const [gruppe, saetze] of Object.entries(eintraege)) {
    m.set(gruppe, new Map([['tag', saetze]]))
  }
  return m
}

describe('ketteFuer', () => {
  it('ordnet die eindeutigen Gruppen zu', () => {
    expect(ketteFuer('Brust')).toBe('druecken')
    expect(ketteFuer('Trizeps')).toBe('druecken')
    expect(ketteFuer('Rücken')).toBe('ziehen')
    expect(ketteFuer('Bizeps')).toBe('ziehen')
    expect(ketteFuer('Trapez')).toBe('ziehen')
  })

  // Der Nutzer benennt seine Gruppen im Kontrollblatt selbst, deshalb
  // Freitext statt fester Liste.
  it('kommt mit eigenen Schreibweisen zurecht', () => {
    expect(ketteFuer('Schulter seitlich')).toBe('druecken')
    expect(ketteFuer('RUECKEN')).toBe('ziehen')
    expect(ketteFuer('lat')).toBe('ziehen')
    expect(ketteFuer('Rudern')).toBe('ziehen')
  })

  // Die hintere Schulter zieht — sie darf nicht an der allgemeinen
  // Schulter-Erkennung hängenbleiben.
  it('zaehlt die hintere Schulter zum Ziehen', () => {
    expect(ketteFuer('Schulter hinten')).toBe('ziehen')
    expect(ketteFuer('Hintere Delta')).toBe('ziehen')
    expect(ketteFuer('Reverse Flys')).toBe('ziehen')
    expect(ketteFuer('Schulter vorne')).toBe('druecken')
  })

  it('laesst alles ausserhalb des Oberkoerpers weg', () => {
    expect(ketteFuer('Quadrizeps')).toBeNull()
    expect(ketteFuer('Waden')).toBeNull()
    expect(ketteFuer('Bauchmuskeln')).toBeNull()
    expect(ketteFuer('Unterarme')).toBeNull()
  })
})

describe('druckZugBilanz', () => {
  it('zaehlt beide Waagschalen und laesst die Beine aussen vor', () => {
    const b = druckZugBilanz(tabelle({ Brust: 8, Trizeps: 4, 'Rücken': 6, Bizeps: 3, Quadrizeps: 12 }))
    expect(b.druecken).toBe(12)
    expect(b.ziehen).toBe(9)
    expect(b.gruppen.map(g => g.name)).not.toContain('Quadrizeps')
  })

  it('gibt bei gleich vielen Saetzen die volle Punktzahl', () => {
    const b = druckZugBilanz(tabelle({ Brust: 10, 'Rücken': 10 }))
    expect(b.punktzahl).toBe(10)
    expect(b.lage).toBe('ausgeglichen')
  })

  it('halbiert die Punktzahl bei doppelt so viel Druecken', () => {
    const b = druckZugBilanz(tabelle({ Brust: 10, 'Rücken': 5 }))
    expect(b.punktzahl).toBe(5)
    expect(b.lage).toBe('zu-wenig-zug')
  })

  // Ein leichter Ueberhang ist normales Training und darf nicht warnen.
  it('nennt einen leichten Ueberhang noch ausgeglichen', () => {
    const b = druckZugBilanz(tabelle({ Brust: 10, 'Rücken': 8 }))
    expect(b.punktzahl).toBe(8)
    expect(b.lage).toBe('ausgeglichen')
  })

  it('meldet auch den umgekehrten Fall', () => {
    const b = druckZugBilanz(tabelle({ Brust: 4, 'Rücken': 12 }))
    expect(b.lage).toBe('zu-wenig-druck')
  })

  it('gibt null zurueck, solange nichts abgehakt ist', () => {
    const b = druckZugBilanz(tabelle({ Quadrizeps: 9 }))
    expect(b.punktzahl).toBeNull()
    expect(b.lage).toBeNull()
  })

  it('kommt mit einer leeren Woche klar', () => {
    const b = druckZugBilanz(new Map())
    expect(b).toEqual({ druecken: 0, ziehen: 0, gruppen: [], punktzahl: null, lage: null })
  })

  // Nur Druecken: die andere Waagschale ist leer, das ist die schaerfste
  // Schieflage.
  it('gibt 0 Punkte, wenn eine Seite ganz fehlt', () => {
    const b = druckZugBilanz(tabelle({ Brust: 9 }))
    expect(b.punktzahl).toBe(0)
    expect(b.lage).toBe('zu-wenig-zug')
  })
})
