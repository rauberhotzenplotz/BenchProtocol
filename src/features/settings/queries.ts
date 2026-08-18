import { useMutation } from '@tanstack/react-query'
import { MUTATION_KEYS } from '../../lib/offline/keys'
import type { BackupDaten } from '../../lib/offline/bulk'

// Verhalten zentral in src/lib/offline/bulk.ts.
export function useRestoreBackup() {
  return useMutation<void, Error, BackupDaten>({ mutationKey: MUTATION_KEYS.restoreBackup })
}

export function useDeleteAllPlans() {
  return useMutation<void, Error, void>({ mutationKey: MUTATION_KEYS.deleteAllPlans })
}
