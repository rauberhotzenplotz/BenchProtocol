import { describe, it, expect } from 'vitest'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { ohneRollbackSchnappschuss } from './persister'

function stand(mutations: PersistedClient['clientState']['mutations']): PersistedClient {
  return {
    buster: '',
    timestamp: 0,
    clientState: { queries: [], mutations },
  }
}

/* Die Mutationsform von TanStack nachgebaut, aber nur so weit wie noetig —
   getestet wird, was mit dem Kontext passiert, nicht das Schema. */
function mutation(context: unknown) {
  return {
    mutationKey: ['upsertSet'],
    state: {
      context,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      variables: { kg: 100 },
      submittedAt: 0,
    },
  } as unknown as PersistedClient['clientState']['mutations'][number]
}

describe('ohneRollbackSchnappschuss', () => {
  it('entfernt den Kontext, laesst aber alles andere stehen', () => {
    const vorher = stand([mutation({ prevSets: [['sets', []]] })])
    const nachher = ohneRollbackSchnappschuss(vorher)

    expect(nachher.clientState.mutations[0].state.context).toBeUndefined()
    expect(nachher.clientState.mutations[0].state.variables).toEqual({ kg: 100 })
    expect(nachher.clientState.mutations[0].mutationKey).toEqual(['upsertSet'])
    expect(nachher.clientState.mutations[0].state.isPaused).toBe(true)
  })

  it('laesst das Original unangetastet', () => {
    const kontext = { prevSets: [] }
    const vorher = stand([mutation(kontext)])
    ohneRollbackSchnappschuss(vorher)

    expect(vorher.clientState.mutations[0].state.context).toBe(kontext)
  })

  it('schrumpft den gesicherten Text tatsaechlich', () => {
    const dickerKontext = { prevSets: Array.from({ length: 500 }, (_, i) => ['sets', { id: i, kg: 100 }]) }
    const vorher = stand(Array.from({ length: 20 }, () => mutation(dickerKontext)))

    const gross = JSON.stringify(vorher).length
    const klein = JSON.stringify(ohneRollbackSchnappschuss(vorher)).length
    expect(klein).toBeLessThan(gross / 20)
  })

  it('reicht einen Stand ohne Mutationen unveraendert durch', () => {
    const vorher = stand([])
    expect(ohneRollbackSchnappschuss(vorher)).toBe(vorher)
  })

  it('laesst eine Mutation ohne Kontext unangetastet', () => {
    const vorher = stand([mutation(undefined)])
    expect(ohneRollbackSchnappschuss(vorher).clientState.mutations[0]).toBe(vorher.clientState.mutations[0])
  })
})
