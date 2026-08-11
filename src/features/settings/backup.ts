import { supabase } from '../../lib/supabase'
import type {
  BenchProgressionRow,
  Exercise,
  LoggedSet,
  Plan,
  PlanDay,
  TrainingSession,
  VolumeRow,
} from '../../types/db'

export interface Backup {
  format: 'benchprotocol-backup'
  version: 1
  exported_at: string
  plans: Plan[]
  plan_days: PlanDay[]
  exercises: Exercise[]
  bench_progression: BenchProgressionRow[]
  volume_rows: VolumeRow[]
  logged_sets: LoggedSet[]
  sessions: TrainingSession[]
}

/** RLS begrenzt jede Abfrage ohnehin auf die eigenen Zeilen — export lädt
    deshalb einfach "alles" aus jeder Tabelle. */
export async function baueBackup(): Promise<Backup> {
  const holen = async <T>(tabelle: string): Promise<T[]> => {
    const { data, error } = await supabase.from(tabelle).select('*')
    if (error) throw error
    return data as T[]
  }

  const [plans, plan_days, exercises, bench_progression, volume_rows, logged_sets, sessions] = await Promise.all([
    holen<Plan>('plans'),
    holen<PlanDay>('plan_days'),
    holen<Exercise>('exercises'),
    holen<BenchProgressionRow>('bench_progression'),
    holen<VolumeRow>('volume_rows'),
    holen<LoggedSet>('logged_sets'),
    holen<TrainingSession>('sessions'),
  ])

  return {
    format: 'benchprotocol-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    plans,
    plan_days,
    exercises,
    bench_progression,
    volume_rows,
    logged_sets,
    sessions,
  }
}

export function backupHerunterladen(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const datum = backup.exported_at.slice(0, 10)
  a.href = url
  a.download = `benchprotocol-backup-${datum}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function istBackup(wert: unknown): wert is Backup {
  return !!wert && typeof wert === 'object' && (wert as Backup).format === 'benchprotocol-backup'
}

/** user_id nie aus der Datei übernehmen — auch nicht aus der eigenen alten
    Sicherung. Die Spalte hat default auth.uid(), lässt man sie beim Insert
    weg, setzt die Datenbank die aktuell angemeldete Person automatisch;
    bei einem Konflikt (dieselbe ID existiert schon) bleibt die vorhandene
    user_id ohnehin unangetastet. So kann nie versehentlich eine fremde
    oder veraltete user_id mit hochgeladen werden. */
function ohneUserId<T extends { user_id?: unknown }>(zeilen: T[]): T[] {
  // Der Schlüssel muss wirklich fehlen, nicht nur undefined sein — sonst
  // schickt supabase-js ihn u. U. trotzdem als null mit, und das verletzt
  // die RLS-Policy (auth.uid() = user_id) bzw. die not-null-Spalte.
  return zeilen.map(z => {
    const kopie: Record<string, unknown> = { ...z }
    delete kopie.user_id
    return kopie as T
  })
}

/** Reihenfolge wichtig: Eltern vor Kindern wegen Fremdschlüsseln. Bereits
    vorhandene IDs (z. B. beim erneuten Einspielen desselben Backups)
    werden per upsert überschrieben statt einen Fehler zu werfen. */
export async function backupEinspielen(datei: File): Promise<Backup> {
  const text = await datei.text()
  const wert: unknown = JSON.parse(text)
  if (!istBackup(wert)) throw new Error('Das ist keine Bench-Protocol-Sicherung.')

  const schreiben = async (tabelle: string, zeilen: unknown[]) => {
    if (!zeilen.length) return
    const { error } = await supabase.from(tabelle).upsert(ohneUserId(zeilen as { user_id?: unknown }[]))
    if (error) throw error
  }

  await schreiben('plans', wert.plans)
  await schreiben('plan_days', wert.plan_days)
  await schreiben('exercises', wert.exercises)
  await schreiben('bench_progression', wert.bench_progression)
  await schreiben('volume_rows', wert.volume_rows)
  await schreiben('logged_sets', wert.logged_sets)
  await schreiben('sessions', wert.sessions)

  return wert
}
