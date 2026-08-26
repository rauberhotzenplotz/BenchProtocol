import { describe, it, expect } from 'vitest'
import { modellFlaechenFuer, muskelHitze, frischeVon, hitzeFarbe, hitzeFarbeBlass, ERHOLUNG_TAGE } from './muskelHitze'
import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from '../training/queries'

const TAG = 24 * 60 * 60 * 1000
const JETZT = Date.parse('2026-08-26T12:00:00Z')

/** Baut Tag und Sätze: je Muskelgruppe eine Übung mit n abgehakten
    Sätzen, alle vor `vorTagen` abgehakt. */
function aufbau(eintraege: Array<[gruppe: string, saetze: number, vorTagen: number]>) {
  const days: DayWithExercises[] = [
    { id: 't1', plan_id: 'p', user_id: 'u', name: 'Tag 1', sort_order: 0, created_at: '', exercises: [] } as unknown as DayWithExercises,
  ]
  const alleSaetze: LoggedSet[] = []
  eintraege.forEach(([gruppe, anzahl, vorTagen], i) => {
    const id = 'ex' + i
    ;(days[0].exercises as unknown[]).push({ id, name: gruppe, muscle_group: gruppe, sort_order: i })
    for (let n = 0; n < anzahl; n++) {
      alleSaetze.push({
        id: `${id}-${n}`, exercise_id: id, week: 1, position: n, done: true,
        done_at: new Date(JETZT - vorTagen * TAG).toISOString(),
      } as unknown as LoggedSet)
    }
  })
  return { days, alleSaetze }
}

describe('modellFlaechenFuer', () => {
  it('trifft die eindeutigen Gruppen', () => {
    expect(modellFlaechenFuer('Brust')).toEqual(['chest'])
    expect(modellFlaechenFuer('Trizeps')).toEqual(['triceps'])
    expect(modellFlaechenFuer('Quadrizeps')).toEqual(['quadriceps'])
  })

  // Die Gruppen sind Freitext aus dem Kontrollblatt des Nutzers.
  it('kommt mit eigenen Schreibweisen zurecht', () => {
    expect(modellFlaechenFuer('RUECKEN')).toEqual(['upper-back'])
    expect(modellFlaechenFuer('Lat')).toEqual(['upper-back'])
    expect(modellFlaechenFuer('Oberschenkel hinten')).toEqual(['hamstring'])
  })

  it('trennt die Schulter nach Lage', () => {
    expect(modellFlaechenFuer('Schulter seitlich')).toEqual(['front-deltoids'])
    expect(modellFlaechenFuer('Schulter hinten')).toEqual(['back-deltoids'])
    expect(modellFlaechenFuer('Reverse Flys')).toEqual(['back-deltoids'])
  })

  // Der untere Ruecken muss vor dem allgemeinen "Ruecken" greifen.
  it('unterscheidet oberen und unteren Ruecken', () => {
    expect(modellFlaechenFuer('Unterer Rücken')).toEqual(['lower-back'])
    expect(modellFlaechenFuer('Rücken')).toEqual(['upper-back'])
  })

  it('faerbt fuer Waden alle drei Flaechen', () => {
    expect(modellFlaechenFuer('Waden')).toEqual(['calves', 'left-soleus', 'right-soleus'])
  })

  it('laesst Gruppen ohne Flaeche im Modell aus', () => {
    expect(modellFlaechenFuer('Hüftbeuger')).toEqual([])
    expect(modellFlaechenFuer('Schienbeine')).toEqual([])
  })
})

describe('muskelHitze', () => {
  it('zaehlt Saetze und misst die Zeit seit dem letzten Haken', () => {
    const { days, alleSaetze } = aufbau([['Brust', 12, 0.5], ['Quadrizeps', 9, 6]])
    const h = muskelHitze(days, alleSaetze, JETZT)
    expect(h.flaechen.get('chest')).toEqual({ tage: 0.5, saetze: 12 })
    expect(h.flaechen.get('quadriceps')).toEqual({ tage: 6, saetze: 9 })
  })

  it('sortiert die Gruppen nach Frische', () => {
    const { days, alleSaetze } = aufbau([['Quadrizeps', 9, 6], ['Brust', 12, 0.5], ['Bizeps', 3, 4]])
    const h = muskelHitze(days, alleSaetze, JETZT)
    expect(h.gruppen.map(g => g.name)).toEqual(['Brust', 'Bizeps', 'Quadrizeps'])
  })

  it('zaehlt die frisch gereizten Gruppen der letzten zwei Tage', () => {
    const { days, alleSaetze } = aufbau([['Brust', 8, 0.5], ['Trizeps', 5, 1.5], ['Rücken', 6, 4]])
    expect(muskelHitze(days, alleSaetze, JETZT).frischeGruppen).toBe(2)
  })

  // Zwei Gruppen koennen dieselbe Flaeche treffen. Der frischere Reiz
  // gewinnt, weil er der ist, der noch nachwirkt.
  it('nimmt bei zwei Gruppen auf einer Flaeche den frischeren Reiz', () => {
    const { days, alleSaetze } = aufbau([['Rücken', 6, 5], ['Lat', 4, 1]])
    const h = muskelHitze(days, alleSaetze, JETZT)
    expect(h.flaechen.get('upper-back')?.tage).toBe(1)
  })

  it('laesst Saetze ohne Zeitstempel aus der Erholung heraus', () => {
    const { days, alleSaetze } = aufbau([['Brust', 3, 2]])
    alleSaetze.push({ id: 'alt', exercise_id: 'ex0', week: 1, position: 9, done: true, done_at: null } as unknown as LoggedSet)
    const h = muskelHitze(days, alleSaetze, JETZT)
    expect(h.flaechen.get('chest')?.tage).toBe(2)
  })

  it('zaehlt nur Saetze im Zaehlfenster zur Last', () => {
    const { days, alleSaetze } = aufbau([['Brust', 4, 2]])
    // Vier weitere Saetze, aber 20 Tage alt.
    for (let n = 0; n < 4; n++) {
      alleSaetze.push({
        id: 'alt' + n, exercise_id: 'ex0', week: 1, position: 20 + n, done: true,
        done_at: new Date(JETZT - 20 * TAG).toISOString(),
      } as unknown as LoggedSet)
    }
    expect(muskelHitze(days, alleSaetze, JETZT).flaechen.get('chest')?.saetze).toBe(4)
  })

  it('uebergeht nicht abgehakte Saetze', () => {
    const { days, alleSaetze } = aufbau([['Brust', 2, 1]])
    alleSaetze.push({ id: 'offen', exercise_id: 'ex0', week: 1, position: 8, done: false, done_at: null } as unknown as LoggedSet)
    expect(muskelHitze(days, alleSaetze, JETZT).flaechen.get('chest')?.saetze).toBe(2)
  })

  it('kommt mit einer leeren Historie klar', () => {
    const h = muskelHitze([], [], JETZT)
    expect(h.flaechen.size).toBe(0)
    expect(h.gruppen).toEqual([])
    expect(h.frischeGruppen).toBe(0)
  })
})

describe('frischeVon', () => {
  it('faellt von eins auf null ueber die Erholungsstrecke', () => {
    expect(frischeVon(0)).toBe(1)
    expect(frischeVon(ERHOLUNG_TAGE / 2)).toBeCloseTo(0.5)
    expect(frischeVon(ERHOLUNG_TAGE)).toBe(0)
  })

  it('bleibt bei laengerer Ruhe auf null', () => {
    expect(frischeVon(30)).toBe(0)
  })
})

describe('hitzeFarbe', () => {
  it('leuchtet direkt nach dem Reiz magenta', () => {
    expect(hitzeFarbe(0)).toBe('rgb(255,77,157)')
  })

  it('landet nach der Erholungsstrecke beim Hellblau', () => {
    // Die Mitte zwischen --neon und --violet.
    expect(hitzeFarbe(ERHOLUNG_TAGE)).toBe('rgb(96,182,232)')
    expect(hitzeFarbe(30)).toBe('rgb(96,182,232)')
  })

  // Der Sinn der langen Strecke: Dazwischen liegt sichtbar etwas anderes
  // als die beiden Enden, statt nur umzuschalten.
  it('haelt die Mitte als eigenen Zustand', () => {
    const mitte = hitzeFarbe(ERHOLUNG_TAGE * 0.43)
    expect(mitte).not.toBe(hitzeFarbe(0))
    expect(mitte).not.toBe(hitzeFarbe(ERHOLUNG_TAGE))
    expect(mitte).toBe('rgb(139,124,255)')
  })

  // Am Rotanteil gemessen, nicht am blauen: Violett in der Mitte hat mehr
  // Blau (255) als das Hellblau am Ende (232), der Blauanteil steigt also
  // erst und faellt dann wieder. Durchgehend faellt allein das Rot — und
  // genau das heisst "kuehlt ab".
  it('kuehlt ueber die Tage durchgehend ab', () => {
    const rotAnteil = (f: string) => Number(f.match(/\d+/g)![0])
    const werte = [0, 1, 2, 3, 4, 5, 6, 7].map(d => rotAnteil(hitzeFarbe(d)))
    for (let i = 1; i < werte.length; i++) expect(werte[i]).toBeLessThanOrEqual(werte[i - 1])
    expect(werte[0]).toBe(255)
    expect(werte[werte.length - 1]).toBe(96)
  })
})

describe('hitzeFarbeBlass', () => {
  it('macht aus rgb ein gueltiges rgba', () => {
    expect(hitzeFarbeBlass(0, 0.4)).toBe('rgba(255,77,157, 0.4)')
  })
})
