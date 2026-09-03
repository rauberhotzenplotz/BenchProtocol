import { describe, it, expect } from 'vitest'
import { katalogFiltern, SEITENGROESSE, type KatalogEintrag } from './queries'

function e(id: string, name: string, gruppe: string, pop: number): KatalogEintrag {
  return {
    id,
    name,
    name_en: name,
    name_de_raw: name,
    scheme: null,
    rest: null,
    bench_slot: null,
    muscle_group: gruppe,
    equipment: null,
    difficulty: null,
    popularity: pop,
    primary_muscle: null,
    secondary_muscle: null,
    tertiary_muscle: null,
  }
}

// 60 Rücken-Einträge, damit mehrere Seiten entstehen (SEITENGROESSE = 24).
const katalog: KatalogEintrag[] = [
  ...Array.from({ length: 60 }, (_, i) => e(`r${i}`, `Ruecken ${String(i).padStart(2, '0')}`, 'Rücken', i)),
  ...Array.from({ length: 5 }, (_, i) => e(`b${i}`, `Brust ${i}`, 'Brust', i)),
]

/** Deckt den Offline-Pfad des Übungs-Pickers ab: ohne Netz wird nicht mehr
    serverseitig nachgeladen, sondern der lokale Katalog seitenweise
    zugeschnitten. Vorher lag dort ein fester Deckel bei 200 Einträgen. */
describe('Blättern über den lokalen Katalog (Offline-Pfad im Übungs-Picker)', () => {
  it('ohne Grenze kommen alle Treffer der Muskelgruppe', () => {
    expect(katalogFiltern(katalog, '', 'Rücken')).toHaveLength(60)
    expect(katalogFiltern(katalog, '', 'Brust')).toHaveLength(5)
  })

  it('seitenweises Zuschneiden liefert nach und nach alles, ohne Deckel', () => {
    const alle = katalogFiltern(katalog, '', 'Rücken')
    // So rechnet UebungAuswahl: gefilterte Liste auf seiten * SEITENGROESSE.
    expect(alle.slice(0, 1 * SEITENGROESSE)).toHaveLength(24)
    expect(alle.slice(0, 2 * SEITENGROESSE)).toHaveLength(48)
    // Die letzte Seite bleibt angebrochen und endet bei 60 statt bei 72.
    expect(alle.slice(0, 3 * SEITENGROESSE)).toHaveLength(60)
  })

  it('sortiert nach Bekanntheit, nicht nach Fundreihenfolge', () => {
    const alle = katalogFiltern([e('x', 'Spaet', 'Rücken', 900), e('y', 'Frueh', 'Rücken', 1)], '', 'Rücken')
    expect(alle.map(t => t.name)).toEqual(['Frueh', 'Spaet'])
  })

  // Frueher war bei der Textsuche nach 30 Treffern hart Schluss, ohne
  // Nachladen und ohne Hinweis. Jetzt blaettert auch sie seitenweise, der
  // Filter selbst deckelt also nichts mehr.
  it('die Textsuche liefert alle Treffer, nicht nur die ersten 30', () => {
    expect(katalogFiltern(katalog, 'Ruecken', null)).toHaveLength(60)
  })

  it('geblaettert wird auch bei der Suche in Seiten der ueblichen Groesse', () => {
    const alle = katalogFiltern(katalog, 'Ruecken', null)
    expect(alle.slice(0, SEITENGROESSE)).toHaveLength(SEITENGROESSE)
    expect(alle.slice(0, 3 * SEITENGROESSE)).toHaveLength(60)
  })

  // Die Grenze bleibt als Moeglichkeit erhalten, wird aber nicht mehr
  // vom Picker genutzt.
  it('haelt sich an eine ausdrueckliche Grenze, wenn eine kommt', () => {
    expect(katalogFiltern(katalog, 'Ruecken', null, 30)).toHaveLength(30)
  })
})
