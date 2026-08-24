import { describe, it, expect } from 'vitest'
import { ziehStil, type ZiehZustand } from './ziehSortieren'

const zustand = (teil: Partial<ZiehZustand> = {}): ZiehZustand => ({
  achse: 'y',
  von: 1,
  nach: 1,
  schritt: 60,
  versatz: 0,
  ...teil,
})

describe('ziehStil', () => {
  it('laesst alles in Ruhe, solange nichts aufgenommen ist', () => {
    expect(ziehStil(null, 0)).toEqual({})
  })

  it('haengt den aufgenommenen Eintrag an den Finger', () => {
    const stil = ziehStil(zustand({ von: 1, nach: 1, versatz: 25 }), 1)
    expect(stil.transform).toBe('translateY(25px) scale(1.04)')
    expect(stil.transition).toBe('none')
    // Der gezogene Eintrag darf die Treffererkennung nicht abfangen.
    expect(stil.pointerEvents).toBe('none')
  })

  // Beim Ziehen nach unten ruecken die uebersprungenen Eintraege nach
  // oben nach -- so entsteht die Luecke, in die abgelegt wird.
  it('laesst die uebersprungenen Eintraege nach oben ausweichen', () => {
    const z = zustand({ von: 0, nach: 2 })
    expect(ziehStil(z, 1).transform).toBe('translateY(-60px)')
    expect(ziehStil(z, 2).transform).toBe('translateY(-60px)')
    expect(ziehStil(z, 3).transform).toBeUndefined()
  })

  it('laesst sie beim Ziehen nach oben nach unten ausweichen', () => {
    const z = zustand({ von: 3, nach: 1 })
    expect(ziehStil(z, 1).transform).toBe('translateY(60px)')
    expect(ziehStil(z, 2).transform).toBe('translateY(60px)')
    expect(ziehStil(z, 0).transform).toBeUndefined()
  })

  it('bewegt niemanden, solange der Platz derselbe ist', () => {
    const z = zustand({ von: 2, nach: 2 })
    expect(ziehStil(z, 0).transform).toBeUndefined()
    expect(ziehStil(z, 1).transform).toBeUndefined()
    expect(ziehStil(z, 3).transform).toBeUndefined()
  })

  // Der Uebungsstreifen im Gym-Modus liegt quer.
  it('schiebt auf der x-Achse zur Seite', () => {
    const z = zustand({ achse: 'x', von: 0, nach: 1, schritt: 44, versatz: 30 })
    expect(ziehStil(z, 0).transform).toBe('translateX(30px) scale(1.04)')
    expect(ziehStil(z, 1).transform).toBe('translateX(-44px)')
  })
})
