import { describe, it, expect } from 'vitest'
import { standAus } from './trainingsStand'

describe('standAus', () => {
  it('liest einen vollstaendigen Stand', () => {
    expect(standAus('{"dayId":"t1","woche":3,"gymOffen":true,"uebIdx":2}')).toEqual({
      dayId: 't1',
      woche: 3,
      gymOffen: true,
      uebIdx: 2,
    })
  })

  it('ergaenzt fehlende Felder mit dem Ausgangszustand', () => {
    expect(standAus('{"dayId":"t1","woche":1}')).toEqual({ dayId: 't1', woche: 1, gymOffen: false, uebIdx: 0 })
  })

  // Ein kaputter Eintrag darf den Trainings-Tab nicht lahmlegen — lieber
  // ohne Gedaechtnis starten als gar nicht.
  it('verwirft alles Unbrauchbare, statt zu werfen', () => {
    for (const roh of [null, '', 'kein json', '[]', '"text"', '42', '{}', '{"woche":1}', '{"dayId":"t1"}', '{"dayId":"","woche":1}', '{"dayId":"t1","woche":"drei"}']) {
      expect(standAus(roh)).toBeNull()
    }
  })

  it('faengt unsinnige Uebungsnummern ab', () => {
    expect(standAus('{"dayId":"t1","woche":1,"uebIdx":-3}')?.uebIdx).toBe(0)
    expect(standAus('{"dayId":"t1","woche":1,"uebIdx":2.7}')?.uebIdx).toBe(2)
    expect(standAus('{"dayId":"t1","woche":1,"uebIdx":"zwei"}')?.uebIdx).toBe(0)
  })

  it('nimmt gymOffen nur als echtes true', () => {
    expect(standAus('{"dayId":"t1","woche":1,"gymOffen":"ja"}')?.gymOffen).toBe(false)
    expect(standAus('{"dayId":"t1","woche":1,"gymOffen":1}')?.gymOffen).toBe(false)
  })
})
