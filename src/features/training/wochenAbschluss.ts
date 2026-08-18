import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { BenchProgressionRow, Exercise } from '../../types/db'
import { setsOf } from './calc'
import { advanceBlockIfDue } from '../bench/queries'

/** Prüft nach dem Beenden einer Einheit, ob die laufende Woche komplett
    abgehakt ist — bei jedem Plan, in jeder Woche, unabhängig vom
    Kalender. Bisher schaltete eine Woche nur nach 7 Tagen weiter
    (wochenAutomatik.ts) oder — nur bei Bankfokus-Plänen, nur in der
    Deload-Woche — sofort bei Vollständigkeit (advanceBlockIfDue). Diese
    Funktion verallgemeinert den zweiten Fall auf alle Wochen und beide
    Plantypen: sobald alle Tage der aktuellen Woche vollständig abgehakt
    sind, schalten die Trainingstage sofort wieder frei, statt auf den
    Kalender zu warten.

    Lädt frisch nach statt sich auf den Cache zu verlassen (läuft direkt
    nach einer Mutation) und ist deshalb selbst nicht offline-fähig —
    genau wie advanceBlockIfDue, an das für die Deload-Woche eines
    Bankfokus-Plans komplett delegiert wird (1RM-Neuberechnung und
    Block-Reset bleiben unverändert dessen Aufgabe). */
export async function pruefeWochenabschluss(qc: QueryClient, planId: string) {
  const { data: plan, error: planErr } = await supabase.from('plans').select('*').eq('id', planId).single()
  if (planErr) throw planErr

  // Die Deload-Woche eines Bankfokus-Plans hat ihre eigene, umfangreichere
  // Logik (1RM-Neuberechnung, Block-Reset) — hier nicht duplizieren.
  if (plan.typ === 'bench' && plan.week === 4) {
    return advanceBlockIfDue(qc, planId)
  }

  const { data: days, error: daysErr } = await supabase
    .from('plan_days')
    .select('*, exercises(*)')
    .eq('plan_id', planId)
  if (daysErr) throw daysErr

  const alleExercises = (days as { exercises: Exercise[] }[]).flatMap(d => d.exercises)
  const exerciseIds = alleExercises.map(ex => ex.id)
  if (!exerciseIds.length) return null

  let progression: BenchProgressionRow[] = []
  if (plan.typ === 'bench') {
    const { data, error } = await supabase.from('bench_progression').select('*').eq('plan_id', planId).eq('week', plan.week)
    if (error) throw error
    progression = data as BenchProgressionRow[]
  }

  const sollFuer = (ex: Exercise) => {
    if (ex.bench_slot) {
      const row = progression.find(r => r.slot === ex.bench_slot)
      if (row) return setsOf(row.scheme)
    }
    return setsOf(ex.scheme)
  }
  const geplant = alleExercises.reduce((a, ex) => a + sollFuer(ex), 0)

  const { data: wochenSaetze, error: setsErr } = await supabase
    .from('logged_sets')
    .select('*')
    .in('exercise_id', exerciseIds)
    .eq('week', plan.week)
  if (setsErr) throw setsErr
  const erledigt = wochenSaetze.filter(s => s.done).length
  if (erledigt < geplant) return null

  // Reine Weiterschaltung, keine Löschung: anders als beim Blockwechsel
  // (Wochenzahlen laufen dort wieder bei 1 an) wächst die Wochenzahl hier
  // schlicht weiter, wie es die kalenderbasierte Automatik ohnehin täte —
  // die Historie bleibt vollständig erhalten.
  const { error: updateErr } = await supabase
    .from('plans')
    .update({ week: plan.week + 1, week_started_at: new Date().toISOString() })
    .eq('id', planId)
  if (updateErr) throw updateErr

  qc.invalidateQueries({ queryKey: ['plans'] })
  qc.invalidateQueries({ queryKey: ['sets'] })
  qc.invalidateQueries({ queryKey: ['session'] })
  qc.invalidateQueries({ queryKey: ['sessions'] })

  return { neueWoche: plan.week + 1 }
}
