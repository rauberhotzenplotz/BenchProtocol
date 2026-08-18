import { useMutationState } from '@tanstack/react-query'
import { MUTATION_KEYS } from './keys'

const ALLE_SCHLUESSEL: readonly (readonly string[])[] = Object.values(MUTATION_KEYS)

function gehoertZurWarteschlange(key: readonly unknown[] | undefined): boolean {
  if (!key) return false
  return ALLE_SCHLUESSEL.some(k => k.length === key.length && k.every((teil, i) => teil === key[i]))
}

/** Zählt die wartenden Schreibvorgänge — inzwischen alle Bereiche der App,
    nicht mehr nur das Training. Getrennt nach "pausiert, weil kein Netz"
    und "läuft gerade nach": eine pausierte Mutation hat status 'pending'
    und isPaused true, eine tatsächlich sendende status 'pending' und
    isPaused false. */
export function useOfflineQueueStatus() {
  const zustaende = useMutationState({
    filters: { predicate: m => gehoertZurWarteschlange(m.options.mutationKey) && m.state.status === 'pending' },
    select: m => m.state.isPaused,
  })
  const wartend = zustaende.filter(isPaused => isPaused).length
  const laufend = zustaende.length - wartend
  return { wartend, laufend }
}
