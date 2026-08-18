import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { BenchProgressionRow } from '../../types/db'
import { MUTATION_KEYS, SYNC_SCOPE } from './keys'
import { optimistisch, zurueckrollen, inListeErsetzen, type Schnappschuss } from './cache'

interface BenchZeileAendern {
  id: string
  pct: number
}

export function registriereBenchMutationen(qc: QueryClient) {
  const filter = { queryKey: ['bench-progression'] }

  qc.setMutationDefaults<void, Error, BenchZeileAendern>(MUTATION_KEYS.updateBenchRow, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ id, pct }) => {
      const { error } = await supabase.from('bench_progression').update({ pct }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, pct }) => optimistisch<BenchProgressionRow>(qc, filter, alt => inListeErsetzen(alt, id, { pct })),
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(filter),
  })
}
