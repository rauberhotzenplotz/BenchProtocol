import { useMutationState } from '@tanstack/react-query'
import { MUTATION_KEYS } from '../../lib/offlineMutations'

const OFFLINE_MUTATION_KEYS: readonly (readonly string[])[] = Object.values(MUTATION_KEYS)

function gehoertZurWarteschlange(key: readonly unknown[] | undefined): boolean {
  if (!key) return false
  return OFFLINE_MUTATION_KEYS.some(k => k.length === key.length && k.every((teil, i) => teil === key[i]))
}

/** Zählt die gerade wartenden Offline-Mutationen (Satz eintragen/löschen,
    Einheit starten/beenden/überspringen) getrennt nach "pausiert, weil kein
    Netz" und "läuft gerade nach" — für die OfflineBanner-Anzeige. Eine
    pausierte Mutation hat status 'pending' und isPaused true; eine gerade
    tatsächlich sendende hat status 'pending' und isPaused false. */
export function useOfflineQueueStatus() {
  const zustaende = useMutationState({
    filters: { predicate: m => gehoertZurWarteschlange(m.options.mutationKey) && m.state.status === 'pending' },
    select: m => m.state.isPaused,
  })
  const wartend = zustaende.filter(isPaused => isPaused).length
  const laufend = zustaende.length - wartend
  return { wartend, laufend }
}
