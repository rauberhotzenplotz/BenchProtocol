import { describe, it, expect } from 'vitest'
import {
  regression,
  streuung,
  wochenReihe,
  intensitaetsKurve,
  wiederholungsKurve,
  WDH_BAENDER,
  glaetten,
  wochentagsMuster,
  serien,
  uebungsAnteile,
  verwertbar,
  tonnage,
  achsenTeilung,
} from './calc'
import type { LoggedSet, TrainingSession } from '../../types/db'

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

describe('wiederholungsKurve', () => {
  it('zählt Sätze je Wiederholungszahl, ohne Lücken aufzufüllen', () => {
    const k = wiederholungsKurve([satz({ reps: 8 }), satz({ reps: 8 }), satz({ reps: 10 })])
    expect(k).toEqual([
      { wdh: 8, saetze: 2 },
      { wdh: 10, saetze: 1 },
    ])
  })

  it('lässt nicht abgehakte Sätze und Sätze ohne Wiederholungen weg', () => {
    expect(wiederholungsKurve([satz({ reps: 5, done: false }), satz({ reps: null })])).toEqual([])
  })
})

describe('WDH_BAENDER', () => {
  it('ordnet jede ganze Wiederholungszahl genau einem Band zu, passend zu den Bereichen', () => {
    const band = (wdh: number) => WDH_BAENDER.filter(b => wdh >= b.von && wdh < b.bis).map(b => b.name)
    expect(band(3)).toEqual(['Maximalkraft'])
    expect(band(4)).toEqual(['Kraft'])
    expect(band(12)).toEqual(['Hypertrophie'])
    expect(band(13)).toEqual(['Kraftausdauer'])
    expect(band(21)).toEqual(['Ausdauer'])
  })
})

describe('intensitaetsKurve', () => {
  const basis = new Map([['ex1', 100]])

  it('zählt Sätze je ganzem Prozent und lässt Prozente ohne Satz weg', () => {
    const k = intensitaetsKurve([satz({ kg: 70 }), satz({ kg: 70 }), satz({ kg: 72 })], basis)
    expect(k).toEqual([
      { prozent: 70, saetze: 2 },
      { prozent: 72, saetze: 1 },
    ])
  })

  it('rundet auf ganze Prozent', () => {
    expect(intensitaetsKurve([satz({ kg: 72.6 })], basis)).toEqual([{ prozent: 73, saetze: 1 }])
  })

  it('misst jede Übung an ihrem eigenen Bestwert', () => {
    const k = intensitaetsKurve([satz({ kg: 40 }), satz({ exercise_id: 'ex2', kg: 20 })], new Map([['ex1', 50], ['ex2', 25]]))
    expect(k).toEqual([{ prozent: 80, saetze: 2 }])
  })

  it('lässt Übungen ohne Bezugswert aus und bleibt ohne Daten leer', () => {
    expect(intensitaetsKurve([satz({ exercise_id: 'ohne', kg: 80 })], basis)).toEqual([])
    expect(intensitaetsKurve([], basis)).toEqual([])
  })
})

describe('intensitaetsKurve als Anstrengung', () => {
  it('rechnet mit dem geschätzten 1RM des Satzes statt mit dem Gewicht', () => {
    // 75 kg × 10 ergibt nach Epley 100 kg — bei Bestwert 100 also 100 %.
    const basis = new Map([['ex1', 100]])
    expect(intensitaetsKurve([satz({ kg: 75, reps: 10 })], basis, 'last')).toEqual([{ prozent: 75, saetze: 1 }])
    expect(intensitaetsKurve([satz({ kg: 75, reps: 10 })], basis, 'anstrengung')).toEqual([{ prozent: 100, saetze: 1 }])
  })

  it('setzt einen leichten Satz mit wenigen Wiederholungen niedrig an', () => {
    // 60 kg × 3 → e1RM 66 kg → 66 %.
    expect(intensitaetsKurve([satz({ kg: 60, reps: 3 })], new Map([['ex1', 100]]), 'anstrengung')).toEqual([
      { prozent: 66, saetze: 1 },
    ])
  })
})

describe('glaetten', () => {
  it('verteilt einen Punkt symmetrisch um seine Stelle', () => {
    const g = glaetten([{ prozent: 70, saetze: 10 }], 2)
    const bei = (p: number) => g.find(x => x.prozent === p)!.wert
    expect(bei(69)).toBeCloseTo(bei(71), 10)
    expect(bei(70)).toBeGreaterThan(bei(71))
    expect(bei(70)).toBeLessThan(10)
  })

  it('erhält die Gesamtzahl der Sätze (bis auf die abgeschnittenen Ränder)', () => {
    const roh = [{ prozent: 60, saetze: 3 }, { prozent: 72, saetze: 7 }, { prozent: 73, saetze: 5 }]
    const summe = glaetten(roh, 2).reduce((a, x) => a + x.wert, 0)
    expect(summe).toBeGreaterThan(14.5)
    expect(summe).toBeLessThanOrEqual(15 + 1e-9)
  })

  it('füllt Lücken zwischen benachbarten Spitzen', () => {
    const g = glaetten([{ prozent: 70, saetze: 5 }, { prozent: 73, saetze: 5 }], 2)
    expect(g.find(x => x.prozent === 71)!.wert).toBeGreaterThan(1)
  })

  it('reicht zwei Bandbreiten über die Daten hinaus, nicht unter 0', () => {
    const g = glaetten([{ prozent: 2, saetze: 1 }, { prozent: 50, saetze: 1 }], 2)
    expect(g[0].prozent).toBe(0)
    expect(g[g.length - 1].prozent).toBe(54)
  })

  it('geht mit Grenze nicht darüber hinaus und erfindet dabei keine Sätze', () => {
    const roh = [{ prozent: 98, saetze: 4 }, { prozent: 100, saetze: 10 }]
    const g = glaetten(roh, 2, 100)
    expect(g[g.length - 1].prozent).toBe(100)
    // Unten wird bei zwei Bandbreiten abgeschnitten, dort fehlt ein Rest;
    // oben darf durch das Spiegeln nichts dazukommen.
    const summe = g.reduce((a, x) => a + x.wert, 0)
    expect(summe).toBeGreaterThan(13.9)
    expect(summe).toBeLessThanOrEqual(14 + 1e-9)
  })

  it('lässt die Spitze an der Grenze an der Grenze', () => {
    const g = glaetten([{ prozent: 100, saetze: 10 }], 2, 100)
    const spitze = g.reduce((a, x) => (x.wert > a.wert ? x : a), g[0])
    expect(spitze.prozent).toBe(100)
  })

  it('bleibt ohne Daten leer', () => {
    expect(glaetten([])).toEqual([])
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
