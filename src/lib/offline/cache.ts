import type { QueryClient, QueryKey, QueryFilters } from '@tanstack/react-query'

/** Gesicherte Cache-Stände für den Rollback nach einem echten Serverfehler. */
export type Schnappschuss = Array<[QueryKey, unknown]>

/** Das immer gleiche Gerüst eines optimistischen Schreibvorgangs: laufende
    Abfragen anhalten (sonst überschreibt eine gerade unterwegs befindliche
    Antwort die lokale Änderung wieder), aktuellen Stand sichern, Änderung
    anwenden, Schnappschuss für den Rollback zurückgeben. */
export async function optimistisch<T>(
  qc: QueryClient,
  filter: QueryFilters,
  aendern: (alt: T[] | undefined) => T[],
): Promise<Schnappschuss> {
  await qc.cancelQueries(filter)
  const vorher = qc.getQueriesData<T[]>(filter)
  qc.setQueriesData<T[]>(filter, alt => aendern(alt))
  return vorher as Schnappschuss
}

/** Gegenstück zu optimistisch(): stellt den gesicherten Stand wieder her.
    Wird nur bei echten Serverfehlern aufgerufen — eine bloß pausierte
    Mutation (offline) meldet keinen Fehler, sondern wartet. */
export function zurueckrollen(qc: QueryClient, schnappschuss: Schnappschuss | undefined) {
  schnappschuss?.forEach(([key, daten]) => qc.setQueryData(key, daten))
}

/** Neue Zeilen bekommen in dieser App immer die höchste sort_order, das
    schlichte Anhängen erhält die Reihenfolge also korrekt. */
export function inListeAnhaengen<T>(alt: T[] | undefined, neu: T): T[] {
  return [...(alt ?? []), neu]
}

export function inListeErsetzen<T extends { id: string }>(alt: T[] | undefined, id: string, patch: Partial<T>): T[] {
  return (alt ?? []).map(z => (z.id === id ? { ...z, ...patch } : z))
}

export function ausListeEntfernen<T extends { id: string }>(alt: T[] | undefined, id: string): T[] {
  return (alt ?? []).filter(z => z.id !== id)
}
