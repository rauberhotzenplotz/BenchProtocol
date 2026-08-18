import { useMutation } from '@tanstack/react-query'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { ImportDaten, CsvSatz } from '../../lib/offline/bulk'

// Verhalten zentral in src/lib/offline/bulk.ts — beide Importe laufen
// über die Warteschlange und funktionieren dadurch auch offline.
export function useImportPlan() {
  return useMutation<void, Error, ImportDaten>({ mutationKey: MUTATION_KEYS.importPlan })
}

export function useImportCsvSets() {
  return useMutation<number, Error, CsvSatz[]>({ mutationKey: MUTATION_KEYS.importCsvSets })
}
