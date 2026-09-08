import { describe, it, expect } from 'vitest'
import {
  regression,
  streuung,
  wochenReihe,
  belastung,
  wiederholungsVerteilung,
  intensitaetsZonen,
  wochentagsMuster,
  serien,
  uebungsAnteile,
  schwerpunkt,
  verwertbar,
  tonnage,
  achsenTeilung,
} from './calc'
import type { LoggedSet, TrainingSession } from '../../types/db'

const TAG = 24 * 60 * 60 * 1000
const JETZT = Date.parse('2026-09-08T12:00:00Z')

function satz(w: Partial<LoggedSet> & { exercise_id?: string }): LoggedSet {
  return {
    id: Math.random().toString(36).slice(2),
    exercise_id: 'ex1',
    user_id: 'u',
    week: 1,
    position: 0,
    kg: 100,
    reps: 5,
    rpe: null,
    done: true,
    done_at: new Date(JETZT).toISOString(),
    rpe_block_id: null,
    created_at: '',
    ...w,
  } as LoggedSet
}

function einheit(w: Partial<TrainingSession>): TrainingSession {
  return {
    id: Math.random().toString(36).slice(2),
    day_id: 't1',
    user_id: 'u',
    week: 1,
    started_at: new Date(JETZT).toISOString(),
    ended_at: new Date(JETZT).toISOString(),
    minutes: 60,
    status: 'completed',
    paused_at: null,
    ...w,
  } as TrainingSession
}

describe('verwertbar', () => {
  it('nimmt nur abgehakte Saetze mit Gewicht und Wiederholungen', () => {
    const alle = [
      satz({}),
      satz({ done: false }),
      satz({ kg: null }),
      satz({ reps: null }),
      satz({ kg: 0 }),
      satz({ reps: 0 }),
    ]
    expect(verwertbar(alle)).toHaveLength(1)
  })
})

describe('tonnage', () => {
  it('multipliziert Gewicht mal Wiederholungen', () => {
    expect(tonnage([satz({ kg: 100, reps: 5 }), satz({ kg: 50, reps: 10 })])).toBe(1000)
  })
})

describe('streuung', () => {
  it('rechnet Mittel, Standardabweichung und Variationskoeffizient', () => {
    const s = streuung([2, 4, 4, 4, 5, 5, 7, 9])!
    expect(s.mittel).toBe(5)
    expect(s.sd).toBe(2)
    expect(s.vk).toBe(0.4)
  })

  it('gibt bei gleichen Werten keine Streuung aus', () => {
    const s = streuung([3, 3, 3])!
    expect(s.sd).toBe(0)
    expect(s.vk).toBe(0)
  })

  it('bleibt bei leerer Eingabe null', () => {
    expect(streuung([])).toBeNull()
  })
})

describe('regression', () => {
  it('findet eine exakte Gerade', () => {
    const r = regression([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ])!
    expect(r.steigung).toBe(2)
    expect(r.achsenabschnitt).toBe(0)
    expect(r.r2).toBe(1)
  })

  it('erkennt eine schwache Beziehung am Bestimmtheitsmass', () => {
    const r = regression([
      { x: 1, y: 5 },
      { x: 2, y: 1 },
      { x: 3, y: 6 },
      { x: 4, y: 2 },
    ])!
    expect(r.r2).toBeLessThan(0.2)
  })

  // Zwei Punkte ergeben immer eine perfekte Gerade -- das waere eine
  // Aussage, die keine ist.
  it('verweigert die Auskunft unter drei Punkten', () => {
    expect(regression([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull()
    expect(regression([])).toBeNull()
  })

  it('verweigert sie auch, wenn alle Punkte auf derselben Stelle liegen', () => {
    expect(regression([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }])).toBeNull()
  })

  it('nennt waagerechte Punkte vollstaendig erklaert', () => {
    const r = regression([{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }])!
    expect(r.steigung).toBe(0)
    expect(r.r2).toBe(1)
  })
})

describe('wochenReihe', () => {
  it('fasst Tonnage, Saetze und Einheiten je Woche zusammen', () => {
    const reihe = wochenReihe(
      [satz({ week: 1, kg: 100, reps: 5 }), satz({ week: 1, kg: 100, reps: 5 }), satz({ week: 2, kg: 60, reps: 10 })],
      [einheit({ week: 1, minutes: 70 }), einheit({ week: 2, minutes: 50 })],
    )
    expect(reihe).toHaveLength(2)
    expect(reihe[0]).toMatchObject({ woche: 1, tonnage: 1000, saetze: 2, wiederholungen: 10, einheiten: 1, minuten: 70 })
    expect(reihe[1]).toMatchObject({ woche: 2, tonnage: 600, saetze: 1, einheiten: 1, minuten: 50 })
  })

  // Eine ausgefallene Woche ist ein Ergebnis. Liesse man sie weg, wuerde
  // aus einer Pause optisch eine durchgehende Linie.
  it('laesst ausgefallene Wochen als Null stehen', () => {
    const reihe = wochenReihe([satz({ week: 1 }), satz({ week: 3 })], [])
    expect(reihe.map(w => w.woche)).toEqual([1, 2, 3])
    expect(reihe[1].tonnage).toBe(0)
    expect(reihe[1].saetze).toBe(0)
  })

  it('mittelt das RPE nur ueber Saetze, die eines tragen', () => {
    const reihe = wochenReihe([satz({ week: 1, rpe: 8 }), satz({ week: 1, rpe: 9 }), satz({ week: 1, rpe: null })], [])
    expect(reihe[0].rpeSchnitt).toBe(8.5)
  })

  it('laesst das RPE leer, wenn keiner eines traegt', () => {
    expect(wochenReihe([satz({ week: 1 })], [])[0].rpeSchnitt).toBeNull()
  })

  it('bleibt ohne Daten leer', () => {
    expect(wochenReihe([], [])).toEqual([])
  })
})

describe('belastung', () => {
  /** n Saetze, alle `vorTagen` Tage alt. */
  const alt = (vorTagen: number, anzahl: number, kg = 100) =>
    Array.from({ length: anzahl }, () =>
      satz({ kg, reps: 10, done_at: new Date(JETZT - vorTagen * TAG).toISOString() }),
    )

  it('zaehlt die akute Last der letzten sieben Tage', () => {
    const b = belastung([...alt(1, 1), ...alt(3, 1), ...alt(10, 1)], JETZT)
    expect(b.akut).toBe(2000)
  })

  it('mittelt die chronische Last ueber vier Wochen', () => {
    // Vier Wochen mit je 1000 kg -> chronisch 1000. Der Satz von vor 40
    // Tagen liegt ausserhalb des Fensters und zaehlt nicht mit; er ist
    // nur da, damit der geforderte Vorlauf erfuellt ist.
    const b = belastung([...alt(40, 1), ...alt(1, 1), ...alt(8, 1), ...alt(15, 1), ...alt(22, 1)], JETZT)
    expect(b.chronisch).toBe(1000)
    expect(b.verhaeltnis).toBe(1)
  })

  // Ohne 28 Tage Vorlauf ist der Nenner kein Gewoehnungswert, sondern
  // Zufall -- dann lieber gar keine Zahl.
  it('nennt kein Verhaeltnis ohne vier Wochen Vorlauf', () => {
    expect(belastung(alt(3, 5), JETZT).verhaeltnis).toBeNull()
  })

  it('erkennt eine Woche, die aus dem Rahmen faellt', () => {
    const b = belastung([...alt(40, 1), ...alt(1, 3), ...alt(8, 1), ...alt(15, 1), ...alt(22, 1)], JETZT)
    expect(b.verhaeltnis).toBeGreaterThan(1.5)
  })

  it('nennt gleichfoermige Belastung monoton', () => {
    // Jeden der sieben Tage dieselbe Last -> Streuung 0 -> keine Zahl,
    // weil durch 0 geteilt wuerde.
    const jedenTag = [0, 1, 2, 3, 4, 5, 6].flatMap(d => alt(d, 1))
    expect(belastung(jedenTag, JETZT).monotonie).toBeNull()

    // Sechs gleiche Tage und ein schwerer -> hohe, aber endliche Monotonie.
    const fastGleich = [...[0, 1, 2, 3, 4, 5].flatMap(d => alt(d, 1)), ...alt(6, 1, 110)]
    const m = belastung(fastGleich, JETZT).monotonie!
    expect(m).toBeGreaterThan(5)
  })

  it('zaehlt die Tage mit Training', () => {
    expect(belastung([...alt(0, 1), ...alt(2, 1), ...alt(5, 1)], JETZT).tageMitTraining).toBe(3)
  })

  it('kommt ohne Saetze klar', () => {
    const b = belastung([], JETZT)
    expect(b.akut).toBe(0)
    expect(b.verhaeltnis).toBeNull()
    expect(b.strain).toBeNull()
  })
})

describe('wiederholungsVerteilung', () => {
  it('sortiert in die ueblichen Bereiche', () => {
    const v = wiederholungsVerteilung([
      satz({ reps: 2 }),
      satz({ reps: 5 }),
      satz({ reps: 10 }),
      satz({ reps: 10 }),
      satz({ reps: 15 }),
      satz({ reps: 25 }),
    ])
    expect(v.map(f => f.saetze)).toEqual([1, 1, 2, 1, 1])
    expect(v[2].anteil).toBeCloseTo(2 / 6, 5)
  })

  it('bleibt ohne Saetze bei lauter Nullen', () => {
    expect(wiederholungsVerteilung([]).every(f => f.saetze === 0 && f.anteil === 0)).toBe(true)
  })
})

describe('intensitaetsZonen', () => {
  const basis = new Map([['ex1', 100]])

  it('ordnet nach Anteil am besten 1RM ein', () => {
    const z = intensitaetsZonen(
      [satz({ kg: 50 }), satz({ kg: 65 }), satz({ kg: 75 }), satz({ kg: 85 }), satz({ kg: 95 })],
      basis,
    )
    expect(z.map(f => f.saetze)).toEqual([1, 1, 1, 1, 1])
  })

  it('laesst Uebungen ohne Bezugswert aus', () => {
    const z = intensitaetsZonen([satz({ exercise_id: 'ohne', kg: 80 })], basis)
    expect(z.every(f => f.saetze === 0)).toBe(true)
  })
})

describe('wochentagsMuster', () => {
  it('zaehlt ab Montag', () => {
    // 2026-09-07 ist ein Montag.
    const m = wochentagsMuster([
      einheit({ started_at: '2026-09-07T10:00:00' }),
      einheit({ started_at: '2026-09-09T10:00:00' }),
      einheit({ started_at: '2026-09-13T10:00:00' }),
    ])
    expect(m[0]).toMatchObject({ name: 'Mo', einheiten: 1 })
    expect(m[2]).toMatchObject({ name: 'Mi', einheiten: 1 })
    expect(m[6]).toMatchObject({ name: 'So', einheiten: 1 })
  })

  it('uebergeht nicht beendete Einheiten', () => {
    const m = wochentagsMuster([einheit({ started_at: '2026-09-07T10:00:00', status: 'skipped' })])
    expect(m.every(t => t.einheiten === 0)).toBe(true)
  })
})

describe('serien', () => {
  it('findet die laengste und die laufende Folge', () => {
    const s = serien([1, 2, 3, 5, 6].map(w => einheit({ week: w })))
    expect(s.laengste).toBe(3)
    expect(s.aktuell).toBe(2)
  })

  it('zaehlt mehrere Einheiten derselben Woche einmal', () => {
    expect(serien([einheit({ week: 4 }), einheit({ week: 4 })]).laengste).toBe(1)
  })

  it('bleibt ohne Einheiten bei null', () => {
    expect(serien([])).toEqual({ laengste: 0, aktuell: 0 })
  })
})

describe('uebungsAnteile', () => {
  const namen = new Map([
    ['a', 'Bankdrücken'],
    ['b', 'Rudern'],
  ])

  it('sortiert nach Volumen und rechnet Anteile', () => {
    const a = uebungsAnteile(
      [satz({ exercise_id: 'a', kg: 100, reps: 10 }), satz({ exercise_id: 'b', kg: 50, reps: 10 })],
      namen,
    )
    expect(a[0].name).toBe('Bankdrücken')
    expect(a[0].anteil).toBeCloseTo(2 / 3, 5)
  })

  it('nennt unbekannte Uebungen beim Namen', () => {
    expect(uebungsAnteile([satz({ exercise_id: 'x' })], namen)[0].name).toBe('Unbekannt')
  })
})

describe('schwerpunkt', () => {
  it('zaehlt, wie viele Uebungen die Haelfte des Volumens tragen', () => {
    const anteile = [
      { id: 'a', name: 'a', tonnage: 60, saetze: 1, anteil: 0.6 },
      { id: 'b', name: 'b', tonnage: 40, saetze: 1, anteil: 0.4 },
    ]
    expect(schwerpunkt(anteile)).toBe(1)
  })

  it('braucht bei gleichmaessiger Verteilung mehr Uebungen', () => {
    const anteile = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: String(i),
      tonnage: 10,
      saetze: 1,
      anteil: 0.1,
    }))
    expect(schwerpunkt(anteile)).toBe(5)
  })

  it('bleibt ohne Uebungen null', () => {
    expect(schwerpunkt([])).toBeNull()
  })
})

describe('achsenTeilung', () => {
  it('waehlt runde Schritte', () => {
    expect(achsenTeilung(100)).toBe(25)
    expect(achsenTeilung(1000)).toBe(250)
    expect(achsenTeilung(4)).toBe(1)
  })

  // Der Zweck: Eine Achse, die bei 17 483 endet, liest niemand.
  it('deckt den Bereich mit hoechstens vier Strichen ab', () => {
    for (const hoch of [7, 42, 137, 980, 17483, 250000]) {
      const s = achsenTeilung(hoch)
      expect(Math.ceil(hoch / s)).toBeLessThanOrEqual(4)
      // Und der Schritt ist eine runde Zahl.
      const stellen = s / 10 ** Math.floor(Math.log10(s))
      expect([1, 2, 2.5, 5]).toContain(Math.round(stellen * 10) / 10)
    }
  })

  it('faellt bei leeren Daten nicht auf null zurueck', () => {
    expect(achsenTeilung(0)).toBe(1)
    expect(achsenTeilung(-5)).toBe(1)
  })
})
