import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { BibliothekseintragAnlegen } from '../../lib/offline/exerciseLibrary'
import type { ExerciseLibraryEntry } from '../../types/db'

/** Muskelgruppen des importierten Katalogs, in einer Reihenfolge, wie sie
    im Studio üblich gedacht werden (Oberkörper drückend/ziehend, dann
    Rumpf, dann Beine) — statt alphabetisch oder nach Häufigkeit im Import
    (dort dominiert "Quadrizeps" mit über 1300 Zeilen rein durch die Zahl
    der Gerätevarianten, das sagt nichts über Wichtigkeit). Fest codiert
    statt per Datenbankabfrage ermittelt: ändert sich der Katalog nicht
    laufend, und so steht die Reihenfolge fest, statt bei jedem Laden neu
    zusammengewürfelt zu werden. */
export const MUSKELGRUPPEN = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme',
  'Bauchmuskeln', 'Hüftbeuger',
  'Gesäß', 'Quadrizeps', 'Beinbeuger', 'Adduktoren', 'Abduktoren', 'Waden', 'Schienbeine',
  'Trapez',
] as const

/** Nicht an einen Plan gebunden — eine Bibliothek je Nutzer, quer über
    alle Pläne nutzbar (dieselbe Übung taucht oft in mehreren Plänen auf).

    Lädt die komplette Tabelle — bei gut 3245 Katalogeinträgen nur noch für
    die Verwaltungsseite (mit eigenem Suchfilter) geeignet, nicht mehr für
    den Übungs-Picker beim Planaufbau. Der nutzt stattdessen
    useLibrarySearch() unten, das serverseitig filtert. */
export function useExerciseLibrary() {
  return useQuery({
    queryKey: ['exercise-library'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_library').select('*').order('sort_order')
      if (error) throw error
      return data as ExerciseLibraryEntry[]
    },
  })
}

/** PostgREST-Filterausdrücke trennen Bedingungen über Kommas und Klammern
    grenzen sie ein — ein Suchbegriff mit einem dieser Zeichen würde den
    .or()-Ausdruck sonst zerschießen. Anführungszeichen ebenfalls raus,
    da der Wert unten selbst in welche eingepackt wird. */
function fuerFilterSaeubern(text: string): string {
  return text.replace(/[,()"]/g, ' ').trim()
}

/** Sucht serverseitig über Name, englischen Namen und den ungekürzten
    deutschen Namen — damit findet z. B. "Bench Press" auch "Langhantel
    Bankdrücken". Erst ab zwei Zeichen aktiv (sonst kämen bei einem
    Buchstaben hunderte Treffer), auf 30 begrenzt: eine Auswahlliste, kein
    Ersatz für die Volltextsuche. 250 ms entprellt, damit nicht jeder
    Tastendruck eine eigene Abfrage auslöst.

    Ist eine Muskelgruppe im Picker bereits gewählt, filtert die Suche
    zusätzlich darauf — wer erst "Rücken" antippt und dann sucht, will
    vermutlich keine Bein-Übung als Treffer sehen. */
export function useLibrarySearch(suchtext: string, muskelgruppe: string | null = null) {
  const [entprellt, setEntprellt] = useState(suchtext)
  useEffect(() => {
    const timer = setTimeout(() => setEntprellt(suchtext), 250)
    return () => clearTimeout(timer)
  }, [suchtext])

  const q = fuerFilterSaeubern(entprellt.trim())

  return useQuery({
    queryKey: ['exercise-library-search', q, muskelgruppe],
    enabled: q.length >= 2,
    queryFn: async () => {
      let query = supabase
        .from('exercise_library')
        .select('*')
        .or(`name.ilike."%${q}%",name_en.ilike."%${q}%",name_de_raw.ilike."%${q}%"`)
      if (muskelgruppe) query = query.eq('muscle_group', muskelgruppe)
      const { data, error } = await query.order('popularity').order('name').limit(30)
      if (error) throw error
      return data as ExerciseLibraryEntry[]
    },
  })
}

/** Schlanke Kopie des gesamten Katalogs für den Betrieb ohne Netz.

    Die Suche oben läuft serverseitig — ohne Verbindung liefert sie nichts,
    und damit ließ sich offline keine einzige Übung hinzufügen (genau so
    gemeldet). Deshalb wird der Katalog einmal komplett geholt und über den
    persistierten Cache mitgesichert; die Suche fällt ohne Netz auf diese
    lokale Kopie zurück (siehe UebungAuswahl in training/SessionView.tsx).

    Bewusst nur die Felder, die Auswahl und Anzeige brauchen: mit allen
    Spalten wäre die gesicherte Kopie ein Vielfaches groß, ohne dass die
    zusätzlichen Angaben im Picker je auftauchen. Supabase liefert
    standardmäßig höchstens 1000 Zeilen je Anfrage, deshalb seitenweise.

    Lange staleTime, weil sich ein importierter Katalog praktisch nie
    ändert — ein unnötiger Neuabruf würde nur Datenvolumen kosten. */
export type KatalogEintrag = Pick<
  ExerciseLibraryEntry,
  'id' | 'name' | 'name_en' | 'name_de_raw' | 'scheme' | 'rest' | 'bench_slot' | 'muscle_group' | 'equipment' | 'difficulty' | 'popularity'
>

const KATALOG_FELDER = 'id,name,name_en,name_de_raw,scheme,rest,bench_slot,muscle_group,equipment,difficulty,popularity'
const KATALOG_SEITE = 1000

export function useLibraryKatalog() {
  return useQuery({
    queryKey: ['exercise-library-katalog'],
    staleTime: 7 * 24 * 60 * 60 * 1000,
    gcTime: Infinity,
    queryFn: async () => {
      const alle: KatalogEintrag[] = []
      for (let von = 0; ; von += KATALOG_SEITE) {
        const { data, error } = await supabase
          .from('exercise_library')
          .select(KATALOG_FELDER)
          .order('popularity')
          .order('name')
          .range(von, von + KATALOG_SEITE - 1)
        if (error) throw error
        const seite = (data ?? []) as unknown as KatalogEintrag[]
        alle.push(...seite)
        if (seite.length < KATALOG_SEITE) break
      }
      return alle
    },
  })
}

/** Dieselbe Auswahl wie die serverseitige Suche, nur lokal auf dem
    zwischengespeicherten Katalog — Grundlage des Offline-Betriebs im
    Übungs-Picker. Reihenfolge wie online: erst Bekanntheit, dann Name. */
export function katalogFiltern(
  katalog: KatalogEintrag[] | undefined,
  suche: string,
  muskelgruppe: string | null,
  grenze = 30,
): KatalogEintrag[] {
  if (!katalog) return []
  const q = suche.trim().toLowerCase()
  const treffer = katalog.filter(e => {
    if (muskelgruppe && e.muscle_group !== muskelgruppe) return false
    if (!q) return true
    return (
      e.name.toLowerCase().includes(q) ||
      (e.name_en?.toLowerCase().includes(q) ?? false) ||
      (e.name_de_raw?.toLowerCase().includes(q) ?? false)
    )
  })
  return treffer
    .sort((a, b) => a.popularity - b.popularity || a.name.localeCompare(b.name))
    .slice(0, grenze)
}

const SEITENGROESSE = 24

/** Übungen einer Muskelgruppe, nach Bekanntheit sortiert (siehe
    exercise_library.popularity, Migration 0012) — Grundlage des
    Muskelgruppen-Durchsuchens im Übungs-Picker. useInfiniteQuery statt
    einer einzelnen Seite: "weitere laden" beim Herunterscrollen hängt
    einfach die nächste Seite an, ohne eigene Zustandsverwaltung für den
    Offset. null-Muskelgruppe hält die Abfrage über `enabled` an, bis der
    Nutzer eine gewählt hat. */
export function useLibraryByMuscleGroup(muskelgruppe: string | null) {
  return useInfiniteQuery({
    queryKey: ['exercise-library-muskelgruppe', muskelgruppe],
    enabled: !!muskelgruppe,
    initialPageParam: 0,
    getNextPageParam: (letzteSeite: ExerciseLibraryEntry[], alleSeiten) =>
      letzteSeite.length < SEITENGROESSE ? undefined : alleSeiten.length,
    queryFn: async ({ pageParam }) => {
      const von = pageParam * SEITENGROESSE
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .eq('muscle_group', muskelgruppe!)
        .order('popularity')
        .order('name')
        .range(von, von + SEITENGROESSE - 1)
      if (error) throw error
      return data as ExerciseLibraryEntry[]
    },
  })
}

// Verhalten zentral in src/lib/offline/exerciseLibrary.ts.
export function useCreateLibraryEntry() {
  return useMutation<void, Error, BibliothekseintragAnlegen>({ mutationKey: MUTATION_KEYS.createLibraryEntry })
}

export function useUpdateLibraryEntry() {
  return useMutation<void, Error, { id: string; patch: Partial<ExerciseLibraryEntry> }>({ mutationKey: MUTATION_KEYS.updateLibraryEntry })
}

export function useDeleteLibraryEntry() {
  return useMutation<void, Error, string>({ mutationKey: MUTATION_KEYS.deleteLibraryEntry })
}
