import { describe, expect, it } from 'vitest'
import { besteVariante, formFuer, mische, pfad, type Punkt } from './ziffernform'

const ZIFFERN = '0123456789'.split('')

function weg(a: Punkt[], b: Punkt[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i][0] - b[i][0]) ** 2 + (a[i][1] - b[i][1]) ** 2
  return s
}

describe('formFuer', () => {
  it('liefert für jede Ziffer gleich viele Punkte — Voraussetzung fürs Morphen', () => {
    const laengen = new Set(ZIFFERN.map(z => formFuer(z).length))
    expect(laengen.size).toBe(1)
  })

  it('hält alle Punkte im Zeichenraster', () => {
    for (const z of ZIFFERN) {
      for (const [x, y] of formFuer(z)) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(160)
      }
    }
  })

  it('tastet gleichmäßig ab: keine Lücken, keine Häufungen', () => {
    for (const z of ZIFFERN) {
      const p = formFuer(z)
      const abstaende = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]))
      const mittel = abstaende.reduce((s, a) => s + a, 0) / abstaende.length
      // Abgetastet wird nach Bogenlänge, gemessen wird die Sehne. An der
      // Spitze der 4 kehrt der Zug fast in sich zurück — dort schneidet
      // die Sehne entsprechend stark ab. Aussagekräftig ist deshalb vor
      // allem die obere Schranke (keine Lücken); die untere hält nur
      // fest, dass sich keine Punkte übereinanderstapeln.
      expect(Math.max(...abstaende)).toBeLessThan(mittel * 1.2)
      expect(Math.min(...abstaende)).toBeGreaterThan(mittel * 0.2)
    }
  })

  it('fällt bei unbekannten Zeichen auf die 0 zurück statt zu scheitern', () => {
    expect(formFuer('x')).toEqual(formFuer('0'))
  })
})

describe('pfad', () => {
  it('beginnt am ersten Punkt und besteht sonst aus Kurvenstücken', () => {
    const p = formFuer('7')
    const d = pfad(p)
    expect(d.startsWith(`M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`)).toBe(true)
    expect((d.match(/C/g) ?? []).length).toBe(p.length - 1)
  })
})

describe('besteVariante', () => {
  it('wählt nie einen längeren Weg als das schlichte Vorwärts-Ziel', () => {
    for (const von of ZIFFERN) {
      for (const nach of ZIFFERN) {
        const stand = formFuer(von)
        const { start, ziel } = besteVariante(stand, nach)
        expect(weg(start, ziel)).toBeLessThanOrEqual(weg(stand, formFuer(nach)) + 1e-9)
      }
    }
  })

  it('kürzt 0 → 9 deutlich ab — dort klappte die Form ohne die Wahl zusammen', () => {
    const stand = formFuer('0')
    const { start, ziel } = besteVariante(stand, '9')
    expect(weg(start, ziel)).toBeLessThan(weg(stand, formFuer('9')) * 0.5)
  })

  it('lässt den Startpunkt geschlossener Formen wandern, offene aber unangetastet', () => {
    // Die 0 ist geschlossen: ihr Startpunkt darf sich verschieben.
    const rund = besteVariante(formFuer('0'), '9')
    expect(rund.start).not.toEqual(formFuer('0'))
    // Die 7 ist offen: an ihrer Punktreihenfolge ist nichts zu drehen.
    const offen = besteVariante(formFuer('7'), '1')
    expect(offen.start).toEqual(formFuer('7'))
  })

  it('behält die gezeichnete Ausgangsform bei, egal welche Variante gewinnt', () => {
    // Verschieben und Umdrehen ändern die Reihenfolge, nicht die Punktmenge.
    // Der letzte Punkt bleibt außen vor: bei geschlossenen Formen ist er
    // die Wiederholung des ersten, und die wandert beim Verschieben mit.
    const stand = formFuer('8')
    const { start } = besteVariante(stand, '3')
    const schluessel = (p: Punkt[]) =>
      p.slice(0, -1).map(q => `${q[0].toFixed(3)},${q[1].toFixed(3)}`).sort().join(' ')
    expect(schluessel(start)).toBe(schluessel(stand))
    expect(start[0]).toEqual(start[start.length - 1])
  })
})

describe('mische', () => {
  it('liefert an den Enden Ausgangs- und Zielform', () => {
    const a = formFuer('2')
    const b = formFuer('5')
    expect(mische(a, b, 0)).toEqual(a)
    // Bei t=1 nicht bitgenau: p + (q - p) * 1 trifft q in Fließkomma nicht
    // exakt. Der Rest liegt bei 1e-14 und ist damit weit unter allem, was
    // im Bild je sichtbar würde.
    mische(a, b, 1).forEach(([x, y], i) => {
      expect(x).toBeCloseTo(b[i][0], 10)
      expect(y).toBeCloseTo(b[i][1], 10)
    })
  })

  it('legt die Mitte zwischen beide Formen', () => {
    const a = formFuer('1')
    const b = formFuer('4')
    const m = mische(a, b, 0.5)
    m.forEach(([x, y], i) => {
      expect(x).toBeCloseTo((a[i][0] + b[i][0]) / 2, 6)
      expect(y).toBeCloseTo((a[i][1] + b[i][1]) / 2, 6)
    })
  })

  it('bewegt jeden Punkt monoton auf sein Gegenstück zu', () => {
    const { start, ziel } = besteVariante(formFuer('9'), '8')
    let vorher = Infinity
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const rest = weg(mische(start, ziel, t), ziel)
      expect(rest).toBeLessThanOrEqual(vorher)
      vorher = rest
    }
    expect(vorher).toBeLessThan(1e-18)
  })
})
