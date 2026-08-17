import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './styles/global.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { registerOfflineMutationDefaults } from './lib/offlineMutations'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// Muss vor dem ersten Rendern stehen: pausierte/wiederhergestellte
// Offline-Mutationen (siehe PersistQueryClientProvider unten) kennen nach
// einem Reload nur ihren mutationKey, nicht die Funktion dahinter — die
// muss also schon registriert sein, bevor resumePausedMutations() greifen
// kann. Siehe src/lib/offlineMutations.ts.
registerOfflineMutationDefaults(queryClient)

// Persistiert den gesamten Query-Cache inkl. pausierter Mutationen in
// localStorage — so überlebt ein offline eingetragener Satz auch einen
// vollständigen Reload/App-Neustart, bevor wieder Internet da ist.
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'benchProtocol-query-cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
      onSuccess={() => {
        // Läuft erst, nachdem der Cache aus localStorage wiederhergestellt
        // ist — genau der vom TanStack-Muster für "Offline Mutations"
        // vorgesehene Zeitpunkt, um zuvor pausierte Mutationen (weil beim
        // letzten Mal offline) wieder anzustoßen.
        void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
