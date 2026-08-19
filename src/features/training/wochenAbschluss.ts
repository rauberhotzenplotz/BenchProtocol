import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { TrainingSession } from '../../types/db'
import { wocheErledigt } from './calc'
import { advanceBlockIfDue } from '../bench/queries'

/** Schaltet die Woche weiter, sobald alle Trainingstage der laufenden
    Woche erledigt sind — beendet oder bewusst übersprungen (siehe
    wocheErledigt in calc.ts).

    Der Takt hängt damit an den Einheiten, nicht am Kalender: wer eine
    Woche mal von Sonntag auf Montag verschiebt, verliert dadurch nichts
    und wird auch nicht mittendrin weitergeschaltet. Die frühere
    7-Tage-Automatik (wochenAutomatik.ts) ist deshalb ersatzlos entfallen;
    liegen gebliebene Tage schließt man über "Überspringen" ab.

    Lädt frisch nach statt sich auf den Cache zu verlassen (läuft direkt
    nach einer Mutation) und ist deshalb selbst nicht offline-fähig —
    genau wie advanceBlockIfDue, an das für die Deload-Woche eines
    Bankfokus-Plans komplett delegiert wird (1RM-Neuberechnung und
    Block-Reset bleiben unverändert dessen Aufgabe). */
export async function pruefeWochenabschluss(qc: QueryClient, planId: string) {
  const { data: plan, error: planErr } = await supabase.from('plans').select('*').eq('id', planId).single()
  if (planErr) throw planErr

  const { data: days, error: daysErr } = await supabase.from('plan_days').select('id').eq('plan_id', planId)
  if (daysErr) throw daysErr
  const dayIds = (days as { id: string }[]).map(d => d.id)
  // Ohne Trainingstage nichts zu tun — und vor allem kein endloses
  // Weiterschalten, siehe wocheErledigt().
  if (!dayIds.length) return null

  const { data: sessions, error: sessErr } = await supabase.from('sessions').select('*').in('day_id', dayIds).eq('week', plan.week)
  if (sessErr) throw sessErr
  if (!wocheErledigt(dayIds, sessions as TrainingSession[], plan.week)) return null

  // Die Deload-Woche eines Bankfokus-Plans hat ihre eigene, umfangreichere
  // Logik (1RM-Neuberechnung, Block-Reset) — hier nicht duplizieren.
  if (plan.typ === 'bench' && plan.week === 4) return advanceBlockIfDue(qc, planId)

  // Reine Weiterschaltung, keine Löschung: anders als beim Blockwechsel
  // (Wochenzahlen laufen dort wieder bei 1 an) wächst die Wochenzahl hier
  // schlicht weiter — die Historie bleibt vollständig erhalten.
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
