/** Stabile Schlüssel für alle schreibenden Vorgänge der App.

    Warum überhaupt Schlüssel: Mutationsfunktionen sind nicht
    serialisierbar. Wird eine offline pausierte Mutation nach einem Reload
    aus dem localStorage wiederhergestellt, kennt TanStack Query nur noch
    diesen Schlüssel — die Funktion dahinter muss vorher einmalig über
    setMutationDefaults() registriert worden sein (siehe ../offlineMutations.ts). */
export const MUTATION_KEYS = {
  // Pläne
  createPlan: ['createPlan'],
  updatePlan: ['updatePlan'],
  deletePlan: ['deletePlan'],
  // Tage und Übungen
  createDay: ['createDay'],
  updateDay: ['updateDay'],
  deleteDay: ['deleteDay'],
  createExercise: ['createExercise'],
  updateExercise: ['updateExercise'],
  deleteExercise: ['deleteExercise'],
  // Sätze
  upsertSet: ['upsertSet'],
  deleteSet: ['deleteSet'],
  // Einheiten
  startSession: ['startSession'],
  endSession: ['endSession'],
  skipSession: ['skipSession'],
  deleteSession: ['deleteSession'],
  pauseSession: ['pauseSession'],
  resumeSession: ['resumeSession'],
  resetSessionSets: ['resetSessionSets'],
  // Bank-Progression
  updateBenchRow: ['updateBenchRow'],
  // Volumen
  createVolumeRow: ['createVolumeRow'],
  updateVolumeRow: ['updateVolumeRow'],
  deleteVolumeRow: ['deleteVolumeRow'],
  // RPE-Blöcke
  createBlock: ['createBlock'],
  logWeek: ['logWeek'],
  setBlockStatus: ['setBlockStatus'],
  deleteBlock: ['deleteBlock'],
  // Übungsbibliothek
  createLibraryEntry: ['createLibraryEntry'],
  updateLibraryEntry: ['updateLibraryEntry'],
  deleteLibraryEntry: ['deleteLibraryEntry'],
  // Massenvorgänge
  importPlan: ['importPlan'],
  importCsvSets: ['importCsvSets'],
  restoreBackup: ['restoreBackup'],
  deleteAllPlans: ['deleteAllPlans'],
} as const

/** Alle Mutationen teilen sich diesen Bereich, damit sie strikt
    nacheinander in Anlegereihenfolge laufen statt parallel.

    Ohne das holt resumePausedMutations() beim Wiederverbinden alles
    gleichzeitig nach (Promise.all im MutationCache) — ein Übungs-Insert
    könnte vor dem Plan-Insert beim Server ankommen und am Fremdschlüssel
    scheitern. TanStack Query lässt innerhalb eines scope immer nur die
    erste wartende Mutation laufen und stößt danach die nächste an
    (canRun/runNext), womit die Reihenfolge garantiert ist.

    Nebenwirkung: auch online läuft alles seriell. Bei den kleinen
    Einzelzeilen-Schreibvorgängen dieser App ist das unkritisch und nimmt
    nebenbei Wettlaufsituationen heraus. */
export const SYNC_SCOPE = { id: 'benchprotocol-sync' } as const

/** Frische ID für eine neue Zeile. Bewusst clientseitig statt über den
    Datenbank-Default gen_random_uuid(): nur so kann offline sofort ein
    Plan angelegt und im selben Atemzug ein Tag darauf verwiesen werden.
    Beim späteren Sync landet exakt dieselbe ID auf dem Server. */
export function neueId(): string {
  return crypto.randomUUID()
}
