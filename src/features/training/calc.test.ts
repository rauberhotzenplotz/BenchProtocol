import { describe, it, expect } from 'vitest'
import { blockWoche, wochenLabel, einheitMinuten, startNachPause, aufwaermPlan, istBankdruecken, satzE1rm, letzteEinheitFuerUebung, muskelgruppenDesTags, wocheErledigt, anzeigeName, schemaMitSaetzen, naechsteSortierung, umsortieren, neueSortierNummern } from './calc'
import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'

function einheit(patch: Partial<TrainingSession>): TrainingSession {
  return {
    id: 'se1', day_id: 'd1', user_id: 'u1', week: 1,
    started_at: '2026-08-17T10:00:00.000Z', ended_at: '2026-08-17T11:00:00.000Z',
    minutes: 60, status: 'completed', paused_at: null,
    ...patch,
  }
}

function exercise(patch: Partial<Exercise>): Exercise {
  return { id: 'ex1', day_id: 'd1', user_id: 'u1', name: 'Bankdrücken', scheme: '4 × 5', rest: '2 min', note: null, bench_slot: null, muscle_group: null, sort_order: 0, library_id: null, ...patch }
}

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'p1', user_id: 'u1', name: 'TrainingsplanBench', typ: 'bench', week: 1,
    week_started_at: '2026-08-17T10:00:00.000Z', sort_order: 0,
    work: 80, reps: 5, rir: 2, plate: 2.5, block: 1, goal: null, goal_from: null,
    beruehrt: true, rpe: null, last_delta_note: null,
    created_at: '', updated_at: '',
    ...patch,
  }
}

function satz(patch: Partial<LoggedSet>): LoggedSet {
  return {
    id: 's1', exercise_id: 'ex1', user_id: 'u1', week: 1, position: 0,
    kg: 100, reps: 5, rpe: null, done: true, done_at: null, rpe_block_id: null, created_at: '',
    ...patch,
  }
}

describe('istBankdruecken', () => {
  it('erkennt über die Bank-Zuordnung', () => {
    expect(istBankdruecken(exercise({ name: 'Irgendwas', bench_slot: 'd1' }))).toBe(true)
  })

  it('erkennt über den Namen, auch ohne Bank-Zuordnung', () => {
    expect(istBankdruecken(exercise({ name: 'Bench Press', bench_slot: null }))).toBe(true)
  })

  it('erkennt andere Übungen nicht als Bankdrücken', () => {
    expect(istBankdruecken(exercise({ name: 'Kniebeuge', bench_slot: null }))).toBe(false)
  })
})

describe('aufwaermPlan', () => {
  it('liefert die volle Leiter fürs Bankdrücken', () => {
    const plan = aufwaermPlan(true, 100, 2.5)
    expect(plan.map(s => s.label)).toEqual(['Leere Stange', '50 %', '65 %', '75 %'])
  })

  it('lässt Stufen unter der leeren Stange weg', () => {
    const plan = aufwaermPlan(true, 30, 2.5)
    expect(plan.every(s => s.kg > 20 || s.label === 'Leere Stange')).toBe(true)
  })

  it('bleibt ohne Gewicht leer', () => {
    expect(aufwaermPlan(true, 0, 2.5)).toEqual([])
  })

  // Frueher bekamen andere Uebungen gar keine Leiter. Gefehlt hat das
  // Aufwaermen im Studio aber bei allem Schweren, nicht nur an der Bank —
  // seitdem dieselben Prozentstufen, nur ohne leere Stange.
  it('gibt anderen Übungen die Prozentstufen ohne Stange', () => {
    expect(aufwaermPlan(false, 200, 2.5).map(s => s.label)).toEqual(['50 %', '65 %', '75 %'])
  })

  it('lässt die Leiter bei leichten Übungen ganz weg', () => {
    expect(aufwaermPlan(false, 10, 2.5)).toEqual([])
  })

  it('führt keine Stufe zweimal mit demselben Gewicht', () => {
    for (const kg of [12.5, 15, 17.5, 20, 25, 40, 77.5]) {
      const gewichte = aufwaermPlan(false, kg, 2.5).map(s => s.kg)
      expect(gewichte).toEqual([...new Set(gewichte)].sort((a, b) => a - b))
    }
  })

  it('bleibt unter dem Arbeitsgewicht', () => {
    for (const kg of [30, 45, 100, 137.5]) {
      for (const s of aufwaermPlan(true, kg, 2.5)) expect(s.kg).toBeLessThan(kg)
    }
  })
})

describe('satzE1rm', () => {
  it('nutzt die RPE-Tabelle, wenn ein RPE-Wert vorliegt', () => {
    // 5 Wdh bei RPE 8 = 81 % laut Tabelle
    expect(satzE1rm(100, 5, 8)).toBeCloseTo(100 / 0.81, 1)
  })

  it('fällt ohne RPE auf Epley zurück', () => {
    expect(satzE1rm(100, 5, null)).toBeCloseTo(100 * (1 + 5 / 30), 1)
  })

  it('fällt außerhalb der RPE-Tabelle (z. B. 12 Wdh) auf Epley zurück', () => {
    expect(satzE1rm(100, 12, 8)).toBeCloseTo(100 * (1 + 12 / 30), 1)
  })

  it('liefert null ohne Gewicht oder Wiederholungen', () => {
    expect(satzE1rm(null, 5, null)).toBeNull()
    expect(satzE1rm(100, null, null)).toBeNull()
  })
})

describe('letzteEinheitFuerUebung', () => {
  it('liefert die Sätze der letzten Woche vor der aktuellen', () => {
    const saetze = [
      satz({ id: 'a', week: 1, position: 0, kg: 90 }),
      satz({ id: 'b', week: 1, position: 1, kg: 92 }),
      satz({ id: 'c', week: 2, position: 0, kg: 95 }),
    ]
    const ergebnis = letzteEinheitFuerUebung('ex1', saetze, 3)
    expect(ergebnis.map(s => s.id)).toEqual(['c'])
  })

  it('ignoriert Sätze der aktuellen Woche selbst', () => {
    const saetze = [satz({ id: 'a', week: 2, kg: 90 }), satz({ id: 'b', week: 3, kg: 95 })]
    expect(letzteEinheitFuerUebung('ex1', saetze, 3).map(s => s.id)).toEqual(['a'])
  })

  it('liefert eine leere Liste ohne vorige Woche', () => {
    expect(letzteEinheitFuerUebung('ex1', [satz({ week: 1 })], 1)).toEqual([])
  })
})

describe('muskelgruppenDesTags', () => {
  it('summiert Sätze je Muskelgruppe, absteigend sortiert', () => {
    const ex = [
      exercise({ id: 'e1', muscle_group: 'Brust', scheme: '4 × 5' }),
      exercise({ id: 'e2', muscle_group: 'Trizeps', scheme: '3 × 8' }),
      exercise({ id: 'e3', muscle_group: 'Brust', scheme: '3 × 8' }),
    ]
    expect(muskelgruppenDesTags(ex)).toEqual([
      { gruppe: 'Brust', saetze: 7 },
      { gruppe: 'Trizeps', saetze: 3 },
    ])
  })

  it('lässt Übungen ohne Muskelgruppe weg', () => {
    expect(muskelgruppenDesTags([exercise({ muscle_group: null })])).toEqual([])
  })
})

describe('wocheErledigt', () => {
  it('ist erledigt, wenn jeder Tag eine beendete Einheit hat', () => {
    const sessions = [einheit({ day_id: 'd1' }), einheit({ day_id: 'd2' }), einheit({ day_id: 'd3' })]
    expect(wocheErledigt(['d1', 'd2', 'd3'], sessions, 1)).toBe(true)
  })

  it('zählt übersprungene Tage als erledigt', () => {
    const sessions = [einheit({ day_id: 'd1' }), einheit({ day_id: 'd2', status: 'skipped' })]
    expect(wocheErledigt(['d1', 'd2'], sessions, 1)).toBe(true)
  })

  it('ist nicht erledigt, solange ein Tag fehlt', () => {
    expect(wocheErledigt(['d1', 'd2'], [einheit({ day_id: 'd1' })], 1)).toBe(false)
  })

  it('zählt eine noch laufende Einheit nicht als erledigt', () => {
    expect(wocheErledigt(['d1'], [einheit({ day_id: 'd1', ended_at: null })], 1)).toBe(false)
  })

  it('ignoriert Einheiten anderer Wochen', () => {
    expect(wocheErledigt(['d1'], [einheit({ day_id: 'd1', week: 1 })], 2)).toBe(false)
  })

  it('ist ohne Trainingstage nie erledigt', () => {
    expect(wocheErledigt([], [], 1)).toBe(false)
  })
})

describe('anzeigeName', () => {
  it('hängt "(Deload)" an, wenn Bankfokus-Plan, Woche 4 und Bank-Slot zusammentreffen', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Bankdrücken Langhantel (Deload)')
  })

  it('funktioniert unabhängig vom tatsächlichen Übungsnamen', () => {
    const ex = exercise({ name: 'Bankdrücken mit Pause', bench_slot: 'd3' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Bankdrücken mit Pause (Deload)')
  })

  it('lässt den Namen in anderen Wochen unverändert', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 1)).toBe('Bankdrücken Langhantel')
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 3)).toBe('Bankdrücken Langhantel')
  })

  it('lässt den Namen ohne Bank-Zuordnung unverändert, auch in Woche 4', () => {
    const ex = exercise({ name: 'Klimmzüge', bench_slot: null })
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 4)).toBe('Klimmzüge')
  })

  it('lässt den Namen bei allgemeinen Plänen unverändert, auch in Woche 4', () => {
    const ex = exercise({ name: 'Bankdrücken Langhantel', bench_slot: 'd1' })
    expect(anzeigeName(ex, plan({ typ: 'general' }), 4)).toBe('Bankdrücken Langhantel')
  })
})

describe('einheitMinuten', () => {
  it('rechnet die Differenz in Minuten', () => {
    expect(einheitMinuten('2026-09-03T18:00:00Z', '2026-09-03T19:12:00Z')).toBe(72)
  })

  // Der Grund fuer die Umstellung: Frueher stempelte die Mutation ihre
  // Endzeit selbst. Offline lag sie bis zum naechsten Netz in der
  // Warteschlange — und schrieb dann die Dauer bis zum Synchronisieren.
  it('haengt nicht am Zeitpunkt des Speicherns', () => {
    const start = '2026-09-03T18:00:00Z'
    const ende = '2026-09-03T19:00:00Z'
    // Dieselbe Einheit, egal wann sie beim Server ankommt.
    expect(einheitMinuten(start, ende)).toBe(60)
  })

  it('gibt nie weniger als eine Minute zurueck', () => {
    expect(einheitMinuten('2026-09-03T18:00:00Z', '2026-09-03T18:00:05Z')).toBe(1)
    expect(einheitMinuten('2026-09-03T19:00:00Z', '2026-09-03T18:00:00Z')).toBe(1)
  })

  it('faellt bei unbrauchbaren Angaben auf 1 zurueck, statt NaN zu liefern', () => {
    expect(einheitMinuten('kaputt', '2026-09-03T18:00:00Z')).toBe(1)
    expect(einheitMinuten('2026-09-03T18:00:00Z', '')).toBe(1)
  })
})

describe('startNachPause', () => {
  it('schiebt den Start um die Pausendauer nach vorn', () => {
    expect(startNachPause('2026-09-03T18:00:00Z', '2026-09-03T18:30:00Z', '2026-09-03T18:50:00Z')).toBe(
      '2026-09-03T18:20:00.000Z',
    )
  })

  it('laesst den Start bei unsinniger Pause unangetastet', () => {
    const start = '2026-09-03T18:00:00Z'
    expect(startNachPause(start, '2026-09-03T18:30:00Z', '2026-09-03T18:10:00Z')).toBe(start)
    expect(startNachPause(start, 'kaputt', '2026-09-03T18:50:00Z')).toBe(start)
  })

  // Zusammenspiel: Die Pause darf in der Dauer nicht auftauchen.
  it('haelt die Pause aus der Dauer heraus', () => {
    const neuerStart = startNachPause('2026-09-03T18:00:00Z', '2026-09-03T18:30:00Z', '2026-09-03T18:50:00Z')
    expect(einheitMinuten(neuerStart, '2026-09-03T19:20:00Z')).toBe(60)
  })
})

describe('blockWoche', () => {
  it('bildet die ersten vier Wochen auf sich selbst ab', () => {
    expect([1, 2, 3, 4].map(blockWoche)).toEqual([1, 2, 3, 4])
  })

  // Der Kern der Umstellung: Woche 5 ist die erste Woche des zweiten
  // Blocks. Vorher sprang plans.week dafuer auf 1 zurueck — und weil
  // logged_sets allein ueber die Wochenzahl eindeutig sind, musste der
  // alte Block weichen.
  it('faengt im naechsten Block wieder bei eins an', () => {
    expect([5, 6, 7, 8].map(blockWoche)).toEqual([1, 2, 3, 4])
    expect([9, 12, 13].map(blockWoche)).toEqual([1, 4, 1])
  })

  it('trifft die Deload-Woche in jedem Block', () => {
    for (const w of [4, 8, 12, 16, 40]) expect(blockWoche(w)).toBe(4)
  })
})

describe('wochenLabel', () => {
  it('beschriftet Bankfokus-Plaene nach der Blockwoche, nicht nach der laufenden', () => {
    const p = plan({ typ: 'bench' })
    expect(wochenLabel(1, p)).toBe('Woche 1')
    expect(wochenLabel(4, p)).toBe('Woche 4 · Deload')
    // Woche 9 ist Woche 1 des dritten Blocks.
    expect(wochenLabel(9, p)).toBe('Woche 1')
    expect(wochenLabel(12, p)).toBe('Woche 4 · Deload')
  })

  it('zaehlt bei Standardplaenen durch', () => {
    expect(wochenLabel(9, plan({ typ: 'general' }))).toBe('Woche 9')
  })
})

describe('anzeigeName ueber Blockgrenzen', () => {
  it('haengt (Deload) auch in der Deload-Woche spaeterer Bloecke an', () => {
    const ex = { name: 'Bankdrücken Langhantel', bench_slot: 'd1' } as Exercise
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 12)).toBe('Bankdrücken Langhantel (Deload)')
    expect(anzeigeName(ex, plan({ typ: 'bench' }), 9)).toBe('Bankdrücken Langhantel')
  })
})

describe('schemaMitSaetzen', () => {
  it('tauscht nur die Satzanzahl, der Rest bleibt', () => {
    expect(schemaMitSaetzen('4 × 8', 5)).toBe('5 × 8')
    expect(schemaMitSaetzen('3 × 10–12', 4)).toBe('4 × 10–12')
    expect(schemaMitSaetzen('3x10', 2)).toBe('2x10')
  })

  it('erzeugt ein sauberes Schema, wenn keins erkennbar ist', () => {
    expect(schemaMitSaetzen('', 3)).toBe('3 × 10')
    expect(schemaMitSaetzen(null, 4)).toBe('4 × 10')
  })
})

describe('naechsteSortierung', () => {
  it('liegt eins über der höchsten vergebenen Nummer', () => {
    expect(naechsteSortierung([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 2 }])).toBe(3)
  })

  // Der eigentliche Grund für die Funktion: nach einer Löschung ist die
  // Anzahl kleiner als die höchste Nummer und würde kollidieren.
  it('kollidiert nicht mit einer Lücke durch Löschen', () => {
    expect(naechsteSortierung([{ sort_order: 0 }, { sort_order: 2 }])).toBe(3)
  })

  it('beginnt bei 0, wenn noch nichts da ist', () => {
    expect(naechsteSortierung([])).toBe(0)
  })
})

describe('umsortieren', () => {
  it('schiebt einen Eintrag nach hinten', () => {
    expect(umsortieren(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('schiebt einen Eintrag nach vorn', () => {
    expect(umsortieren(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('laesst die Liste in Ruhe, wenn sich der Platz nicht aendert', () => {
    expect(umsortieren(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('greift nicht daneben, wenn der Platz ausserhalb liegt', () => {
    expect(umsortieren(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(umsortieren(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
  })

  it('aendert die uebergebene Liste nicht', () => {
    const liste = ['a', 'b', 'c']
    umsortieren(liste, 0, 2)
    expect(liste).toEqual(['a', 'b', 'c'])
  })
})

describe('neueSortierNummern', () => {
  it('nummeriert durch und meldet nur die Aenderungen', () => {
    expect(
      neueSortierNummern([
        { id: 'b', sort_order: 1 },
        { id: 'a', sort_order: 0 },
        { id: 'c', sort_order: 2 },
      ]),
    ).toEqual([
      { id: 'b', sort_order: 0 },
      { id: 'a', sort_order: 1 },
    ])
  })

  it('meldet nichts, wenn die Reihenfolge schon stimmt', () => {
    expect(
      neueSortierNummern([
        { id: 'a', sort_order: 0 },
        { id: 'b', sort_order: 1 },
      ]),
    ).toEqual([])
  })

  // Der Fall aus den echten Daten: zwei Eintraege auf derselben Nummer.
  // Das Durchnummerieren raeumt die Kollision nebenbei mit auf.
  it('raeumt doppelte Nummern auf', () => {
    expect(
      neueSortierNummern([
        { id: 'a', sort_order: 6 },
        { id: 'b', sort_order: 6 },
      ]),
    ).toEqual([
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
    ])
  })
})
