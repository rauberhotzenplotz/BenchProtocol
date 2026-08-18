import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Plan, PlanDay, Exercise, BenchProgressionRow, VolumeRow, LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../../features/training/queries'
import { MUTATION_KEYS, SYNC_SCOPE } from './keys'
import { optimistisch, zurueckrollen, type Schnappschuss } from './cache'

/** Ein kompletter Plan-Import, bereits mit allen IDs versehen. Das
    Zusammenbauen passiert in importPlan.ts als reine Funktion — hier wird
    nur noch geschrieben, damit der ganze Import als eine Mutation in die
    Warteschlange passt. */
export interface ImportDaten {
  plan: Plan
  tage: PlanDay[]
  uebungen: Exercise[]
  progression: BenchProgressionRow[]
  volumen: VolumeRow[]
}

/** Ein Satz aus dem CSV-Import — ohne id/user_id, die Datenbank setzt
    beides selbst bzw. der unique-Constraint entscheidet über das upsert. */
export type CsvSatz = { exercise_id: string; week: number; position: number; kg: number; reps: number; done: boolean }

export interface BackupDaten {
  plans: Plan[]
  plan_days: PlanDay[]
  exercises: Exercise[]
  bench_progression: BenchProgressionRow[]
  volume_rows: VolumeRow[]
  logged_sets: LoggedSet[]
  sessions: TrainingSession[]
}

/** user_id nie mitschicken: die Spalte hat default auth.uid(), die
    Datenbank setzt also beim Sync die gerade angemeldete Person ein. So
    kann weder eine fremde noch eine veraltete user_id hochgeladen werden.
    Der Schlüssel muss wirklich fehlen, nicht nur undefined sein — sonst
    schickt supabase-js ihn u. U. als null mit und verletzt die RLS-Regel. */
function ohneUserId<T extends { user_id?: unknown }>(zeilen: T[]): Omit<T, 'user_id'>[] {
  return zeilen.map(z => {
    const kopie: Record<string, unknown> = { ...z }
    delete kopie.user_id
    return kopie as Omit<T, 'user_id'>
  })
}

export function registriereMassenMutationen(qc: QueryClient) {
  const planFilter = { queryKey: ['plans'] }

  // ── Excel-Import als neuer Plan ──────────────────────────────────
  qc.setMutationDefaults<void, Error, ImportDaten>(MUTATION_KEYS.importPlan, {
    scope: SYNC_SCOPE,
    mutationFn: async ({ plan, tage, uebungen, progression, volumen }) => {
      // Reihenfolge wegen der Fremdschlüssel: Plan → Tage → Übungen,
      // danach die beiden optionalen Blätter.
      const schreiben = async (tabelle: string, zeilen: { user_id?: unknown }[]) => {
        if (!zeilen.length) return
        const { error } = await supabase.from(tabelle).insert(ohneUserId(zeilen))
        if (error) throw error
      }
      await schreiben('plans', [plan])
      await schreiben('plan_days', tage)
      await schreiben('exercises', uebungen)
      await schreiben('bench_progression', progression)
      await schreiben('volume_rows', volumen)
    },
    onMutate: async ({ plan, tage, uebungen, progression, volumen }) => {
      const schnappschuss = await optimistisch<Plan>(qc, planFilter, alt => [...(alt ?? []), plan])
      // Die Tagesabfrage liefert die Übungen verschachtelt mit.
      const mitUebungen: DayWithExercises[] = tage.map(t => ({
        ...t,
        exercises: uebungen.filter(ex => ex.day_id === t.id).sort((a, b) => a.sort_order - b.sort_order),
      }))
      qc.setQueryData<DayWithExercises[]>(['days', plan.id], mitUebungen)
      qc.setQueryData<BenchProgressionRow[]>(['bench-progression', plan.id], progression)
      qc.setQueryData<VolumeRow[]>(['volume-rows', plan.id], volumen)
      return schnappschuss
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: (_d, { plan }) => {
      qc.invalidateQueries(planFilter)
      qc.invalidateQueries({ queryKey: ['days', plan.id] })
      qc.invalidateQueries({ queryKey: ['bench-progression', plan.id] })
      qc.invalidateQueries({ queryKey: ['volume-rows', plan.id] })
    },
  })

  // ── CSV-Import geloggter Sätze ───────────────────────────────────
  qc.setMutationDefaults<number, Error, CsvSatz[]>(MUTATION_KEYS.importCsvSets, {
    scope: SYNC_SCOPE,
    mutationFn: async saetze => {
      if (!saetze.length) return 0
      const { error } = await supabase.from('logged_sets').upsert(saetze, { onConflict: 'exercise_id,week,position' })
      if (error) throw error
      return saetze.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sets'] })
      qc.invalidateQueries({ queryKey: ['sets-all'] })
    },
  })

  // ── Sicherung einspielen ─────────────────────────────────────────
  qc.setMutationDefaults<void, Error, BackupDaten>(MUTATION_KEYS.restoreBackup, {
    scope: SYNC_SCOPE,
    mutationFn: async backup => {
      // Eltern vor Kindern. Vorhandene IDs werden überschrieben statt einen
      // Fehler zu werfen — dasselbe Backup lässt sich mehrfach einspielen.
      const schreiben = async (tabelle: string, zeilen: { user_id?: unknown }[]) => {
        if (!zeilen.length) return
        const { error } = await supabase.from(tabelle).upsert(ohneUserId(zeilen))
        if (error) throw error
      }
      await schreiben('plans', backup.plans)
      await schreiben('plan_days', backup.plan_days)
      await schreiben('exercises', backup.exercises)
      await schreiben('bench_progression', backup.bench_progression)
      await schreiben('volume_rows', backup.volume_rows)
      await schreiben('logged_sets', backup.logged_sets)
      await schreiben('sessions', backup.sessions)
    },
    // Bewusst ohne optimistisches Schreiben: eine Sicherung greift quer
    // durch alle Tabellen, den Cache dafür nachzubilden wäre aufwendig und
    // fehleranfällig. Nach dem Sync lädt die Oberfläche ohnehin komplett neu.
    onSuccess: () => qc.invalidateQueries(),
  })

  // ── Alle Pläne löschen ───────────────────────────────────────────
  qc.setMutationDefaults<void, Error, void>(MUTATION_KEYS.deleteAllPlans, {
    scope: SYNC_SCOPE,
    mutationFn: async () => {
      const { error } = await supabase.from('plans').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) throw error
    },
    onMutate: async () => {
      const schnappschuss = await optimistisch<Plan>(qc, planFilter, () => [])
      // Alles, was an Plänen hängt, verschwindet per ON DELETE CASCADE mit.
      ;['days', 'volume-rows', 'bench-progression', 'sets', 'sets-all', 'session', 'sessions', 'sessions-all', 'rpe-blocks', 'rpe-planned-sets'].forEach(
        schluessel => qc.removeQueries({ queryKey: [schluessel] }),
      )
      return schnappschuss
    },
    onError: (_e, _v, ctx) => zurueckrollen(qc, ctx as Schnappschuss),
    onSuccess: () => qc.invalidateQueries(),
  })
}
