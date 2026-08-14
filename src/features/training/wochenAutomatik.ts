import type { Plan } from '../../types/db'

const TAG_MS = 864e5
const WOCHE_TAGE = 7
/** Bankfokus-Blöcke haben genau vier feste Wochen (siehe wochenLabel in
    training/calc.ts) — Woche 4 ist die Deload-Woche. */
const BENCH_MAX_WOCHE = 4

function verschobenesStartdatum(startIso: string, wochenSprung: number): string {
  return new Date(new Date(startIso).getTime() + wochenSprung * WOCHE_TAGE * TAG_MS).toISOString()
}

/** Ersetzt die frühere manuelle W1–W4/Deload-Auswahl: die Woche schaltet
    von selbst weiter, sobald seit ihrem Start 7 Tage vergangen sind — der
    Kalender-Streifen zeigt zwar die Trainingshistorie, setzt aber nirgends,
    in welcher Woche der Plan gerade steckt, das musste weiterhin irgendwo
    passieren.

    Reine Funktion, damit der Sprung über mehrere Wochen hinweg (die App
    war z. B. drei Wochen nicht offen) sich in einem Schritt berechnen
    lässt, statt bei jedem Aufruf nur um eine Woche weiterzurücken.
    week_started_at wandert dabei um genau volle Wochen mit, nicht auf
    den Aufrufzeitpunkt — sonst verschöbe sich der Wochentag von Aufruf
    zu Aufruf.

    Liefert null, wenn (noch) kein Wechsel ansteht. */
export function naechsteWoche(plan: Plan, jetzt: Date = new Date()): { week: number; week_started_at: string } | null {
  const vergangeneTage = (jetzt.getTime() - new Date(plan.week_started_at).getTime()) / TAG_MS
  const vergangeneWochen = Math.floor(vergangeneTage / WOCHE_TAGE)
  if (vergangeneWochen <= 0) return null

  if (plan.typ === 'bench') {
    // Deload (Woche 4) endet nicht nach Kalenderzeit, sondern wenn der
    // Block abgeschlossen wird (siehe useAutoAdvanceBlock in
    // bench/queries.ts, das zählt die abgehakten Sätze) — darüber hinaus
    // rückt hier nichts mehr weiter.
    if (plan.week >= BENCH_MAX_WOCHE) return null
    const ziel = Math.min(BENCH_MAX_WOCHE, plan.week + vergangeneWochen)
    if (ziel === plan.week) return null
    return { week: ziel, week_started_at: verschobenesStartdatum(plan.week_started_at, ziel - plan.week) }
  }

  return { week: plan.week + vergangeneWochen, week_started_at: verschobenesStartdatum(plan.week_started_at, vergangeneWochen) }
}
