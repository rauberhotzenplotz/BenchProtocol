import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/** Nimmt jeder gesicherten Mutation ihren Rollback-Schnappschuss.

    Der Grund ist gemessen, nicht vermutet. Jede Satz-Mutation legt in
    `onMutate` den kompletten vorherigen Stand aller `sets`- und
    `sets-all`-Abfragen als Kontext ab, damit `onError` ihn zurueckspielen
    kann (siehe offline/training.ts). In Arbeitsspeicher ist das billig --
    es sind Verweise auf dieselben Objekte. Beim Sichern wird daraus
    jedoch JSON, und dann traegt jede einzelne wartende Mutation eine
    vollstaendige Kopie der gesamten Satzhistorie mit sich.

    Auf dem Testgeraet (OnePlus 6T, 39 wartende Mutationen) waren das:

      mit Kontext    1892 KB, 65 ms pro Schreibvorgang
      ohne Kontext     74 KB,  1 ms pro Schreibvorgang

    Und geschrieben wird bei jeder Cache-Aenderung. Waehrend des Loggens
    im Studio blockierte das den Hauptfaden also etwa jede Sekunde fuer
    vier Bilder.

    Verloren geht dabei nichts: Der Schnappschuss dient allein dazu, eine
    optimistische Aenderung im selben Sitzungsverlauf zurueckzunehmen.
    Nach einem Neustart ist er ohnehin wertlos -- der Cache, auf den er
    zurueckrollen wuerde, ist derselbe wiederhergestellte Stand, in dem
    die optimistische Aenderung bereits steckt. Alle Rollback-Helfer
    vertragen einen fehlenden Kontext von sich aus (`ctx?.` bzw. ein
    frueher `return`), und was wirklich gilt, holt das `onSuccess` der
    Mutation mit `invalidateQueries` ohnehin frisch vom Server. */
export function ohneRollbackSchnappschuss(client: PersistedClient): PersistedClient {
  const mutationen = client.clientState?.mutations
  if (!mutationen?.length) return client
  return {
    ...client,
    clientState: {
      ...client.clientState,
      mutations: mutationen.map(m => (m.state?.context === undefined ? m : { ...m, state: { ...m.state, context: undefined } })),
    },
  }
}

/** Der Persister der App: sichert den Query-Cache in den uebergebenen
    Speicher, aber ohne die Rollback-Schnappschuesse (siehe oben). */
export function erzeugePersister(storage: Storage, key: string): Persister {
  const roh = createSyncStoragePersister({ storage, key })
  return {
    ...roh,
    persistClient: client => roh.persistClient(ohneRollbackSchnappschuss(client)),
  }
}
