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
    deshalb einfach "alles" aus jeder Tabelle.

    Als einziger Vorgang der App bewusst nicht offline-fähig: eine Sicherung
    aus dem lokalen Cache wäre womöglich unvollständig, und genau darauf
    verlässt man sich im Ernstfall. Lieber ein klarer Hinweis als eine halbe
    Datei, die im Zweifel nach einer echten Sicherung aussieht. */
export async function baueBackup(): Promise<Backup> {
  if (!navigator.onLine) {
    throw new Error('Für eine vollständige Sicherung brauchst du eine Internetverbindung.')
  }
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

/** Liest und prüft eine Sicherungsdatei, ohne zu schreiben. Das Schreiben
    passiert als eine Mutation über die Warteschlange (siehe
    lib/offline/bulk.ts) — damit lässt sich eine Sicherung auch offline
    einspielen und wird beim Wiederverbinden nachgeholt. */
export async function backupLesen(datei: File): Promise<Backup> {
  const text = await datei.text()
  const wert: unknown = JSON.parse(text)
  if (!istBackup(wert)) throw new Error('Das ist keine Bench-Protocol-Sicherung.')
  return wert
}
