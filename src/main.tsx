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
import { registerNativeBackButton } from './lib/nativeShell'
import { registriereNetzErkennung, istNetzfehler, netzfehlerMelden } from './lib/offline/netz'

// Muss vor dem QueryClient stehen: legt fest, woran TanStack Query
// "online" festmacht. Ohne das glaubt es navigator.onLine, das auf
// Android-WebViews auch ohne Netz true meldet — siehe offline/netz.ts.
registriereNetzErkennung()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // 'offlineFirst' statt des Standards 'online': Abfragen dürfen es
      // immer versuchen und liefern bei Misserfolg den zuletzt bekannten
      // Stand aus dem Cache, statt dauerhaft im Ladezustand zu hängen.
      // Genau daran scheiterte die App bisher beim Start ohne Netz.
      networkMode: 'offlineFirst',
      // Ohne Netz keine sinnlosen Neuversuche beim Fensterwechsel — der
      // Cache ist offline die Wahrheit.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Bewusst 'online': nur so pausiert TanStack Query eine Mutation bei
      // fehlendem Netz und legt sie in die Warteschlange, statt sie zu
      // verwerfen. Zusammen mit der Netzerkennung oben ist das die
      // eigentliche Offline-Fähigkeit der App.
      networkMode: 'online',
      // Ein Netzfehler darf die Mutation niemals endgültig scheitern
      // lassen: Wir melden "offline" und lassen weiter wiederholen — dann
      // pausiert Query den Versuch, persistiert ihn und holt ihn nach,
      // sobald wieder Verbindung besteht. Alles andere (echte Serverfehler
      // wie ein verletzter Fremdschlüssel) darf nach zwei Versuchen
      // aufgeben, sonst hinge die Warteschlange für immer.
      retry: (anzahl, fehler) => {
        if (istNetzfehler(fehler)) {
          netzfehlerMelden()
          return true
        }
        return anzahl < 2
      },
      retryDelay: versuch => Math.min(1000 * 2 ** versuch, 30_000),
    },
  },
})

// Muss vor dem ersten Rendern stehen: pausierte/wiederhergestellte
// Offline-Mutationen (siehe PersistQueryClientProvider unten) kennen nach
// einem Reload nur ihren mutationKey, nicht die Funktion dahinter — die
// muss also schon registriert sein, bevor resumePausedMutations() greifen
// kann. Siehe src/lib/offlineMutations.ts.
registerOfflineMutationDefaults(queryClient)
registerNativeBackButton()

// Persistiert den gesamten Query-Cache inkl. pausierter Mutationen in
// localStorage — so überlebt ein offline eingetragener Satz auch einen
// vollständigen Reload/App-Neustart, bevor wieder Internet da ist.
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'benchProtocol-query-cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // 30 Tage statt 24 Stunden: Wer eine Woche ohne Netz trainiert,
        // darf seinen Plan nicht verlieren.
        maxAge: 30 * 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // Der wichtigste Punkt am ganzen Offline-Verhalten: Standardmäßig
          // sichert TanStack Query nur Abfragen im Zustand 'success'. Ohne
          // Netz scheitert beim Start aber jede Abfrage, fällt auf 'error'
          // und flog damit aus dem gesicherten Cache — bei jedem Start ein
          // Stück mehr. Nach dem zweiten Start ohne Netz stand die App
          // deshalb vor "Kein Plan" (nachgestellt und gemessen). Gesichert
          // wird jetzt alles, wozu überhaupt Daten vorliegen; ein
          // fehlgeschlagener Aktualisierungsversuch ändert daran nichts.
          // Der Übungskatalog ist ausgenommen: Er allein war 1136 der
          // 1229 KB des gesicherten Standes, und der Persister schreibt
          // bei jeder Änderung alles neu — beim Abhaken eines Satzes
          // ruckelte die Oberfläche dadurch. Er hat einen eigenen
          // Speicherplatz, der nur beim Abruf beschrieben wird (siehe
          // useLibraryKatalog).
          shouldDehydrateQuery: abfrage =>
            abfrage.state.data !== undefined && abfrage.queryKey[0] !== 'exercise-library-katalog',
        },
      }}
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
