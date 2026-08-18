/** Registriert alle schreibenden Vorgänge der App als offline-fähige
    Mutationen — einmalig in main.tsx, bevor gerendert wird.

    Warum überhaupt zentral und nicht im jeweiligen Hook: Mutationsfunktionen
    sind nicht serialisierbar. Wird eine offline pausierte Mutation nach
    einem Reload aus dem localStorage wiederhergestellt, kennt TanStack
    Query nur noch ihren mutationKey — die Funktion dahinter muss vorab über
    setMutationDefaults() bekannt gemacht worden sein. Die queries.ts der
    einzelnen Bereiche enthalten deshalb nur noch dünne Hüllen um einen
    Schlüssel; das Verhalten steht hier.

    Aufgeteilt nach Bereichen, damit die Datei lesbar bleibt. Siehe
    offline/keys.ts für die Schlüssel und die Erklärung, warum alle
    Mutationen denselben scope teilen (Reihenfolge beim Nachholen). */

import type { QueryClient } from '@tanstack/react-query'
import { registrierePlanMutationen } from './offline/plans'
import { registriereTrainingMutationen } from './offline/training'
import { registriereBenchMutationen } from './offline/bench'
import { registriereVolumenMutationen } from './offline/volume'
import { registriereRpeBlockMutationen } from './offline/rpeblock'
import { registriereMassenMutationen } from './offline/bulk'

export function registerOfflineMutationDefaults(qc: QueryClient) {
  registrierePlanMutationen(qc)
  registriereTrainingMutationen(qc)
  registriereBenchMutationen(qc)
  registriereVolumenMutationen(qc)
  registriereRpeBlockMutationen(qc)
  registriereMassenMutationen(qc)
}
