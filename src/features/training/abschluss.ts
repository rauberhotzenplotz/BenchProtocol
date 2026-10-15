import type { LoggedSet, TrainingSession } from '../../types/db'

type Wert = Pick<LoggedSet, 'kg' | 'reps'>

/** Ist ein Satz besser als derselbe Satz beim letzten Mal? Nur, wenn er
    in keinem der beiden Werte schlechter ist und in mindestens einem
    besser: mehr Gewicht bei gleichen Wiederholungen, mehr Wiederholungen
    bei gleichem Gewicht, oder beides.

    Bewusst nicht über das geschätzte 1RM: 85 kg × 3 statt 82,5 kg × 4
    ergäbe je nach Formel mal ein Plus, mal ein Minus — ein grüner Pfeil
    soll aber nur dort stehen, wo der Satz eindeutig besser war. */
export function satzGesteigert(heute: Wert, letztes: Wert): boolean {
  if (!heute.kg || !heute.reps || !letztes.kg || !letztes.reps) return false
  if (heute.kg < letztes.kg || heute.reps < letztes.reps) return false
  return heute.kg > letztes.kg || heute.reps > letztes.reps
}

/** Wie viele heute abgehakte Sätze einer Übung den Satz an derselben
    Position der letzten Einheit übertroffen haben — die grüne Zahl hinter
    "3 Sätze". Ein Satz ohne Gegenstück beim letzten Mal (heute ein Satz
    mehr) zählt nicht: Es gibt nichts, das er übertroffen hätte. */
export function steigerungen(heute: LoggedSet[], letzteEinheit: LoggedSet[]): number {
  const letzteNachPos = new Map(letzteEinheit.map(s => [s.position, s]))
  return heute.filter(s => {
    const vorher = letzteNachPos.get(s.position)
    return s.done && vorher != null && satzGesteigert(s, vorher)
  }).length
}

type Einheit = Pick<TrainingSession, 'id' | 'started_at' | 'ended_at' | 'status'>

const zaehlt = (e: Einheit) => e.status === 'completed' && e.ended_at != null

/** Die wievielte Einheit überhaupt das hier ist. Der Abschlussbildschirm
    steht vor dem Beenden — die laufende Einheit ist also noch nicht als
    beendet gespeichert und wird hier mitgezählt, ohne sie doppelt zu
    zählen, falls sie es (nach einem erneuten Öffnen) doch schon ist. */
export function workoutNummer(einheiten: Einheit[], aktuelleId?: string | null): number {
  return einheiten.filter(e => zaehlt(e) && e.id !== aktuelleId).length + 1
}

/** Montag 0 Uhr Ortszeit der Woche, in der ein Zeitpunkt liegt — als
    Schlüssel, um Einheiten Kalenderwochen zuzuordnen. */
function wochenStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Wie viele Kalenderwochen am Stück trainiert wurde, die laufende Woche
    eingeschlossen — die aktuelle Einheit sorgt ja gerade dafür, dass sie
    zählt. Die Serie reißt an der ersten Woche ohne beendete Einheit.

    Rückwärts in Wochenschritten über das Datum statt über 7 × 24 Stunden:
    Bei der Zeitumstellung hat eine Woche 167 oder 169 Stunden, und eine
    feste Spanne landete dann einmal im Jahr eine Stunde neben Montag 0 Uhr. */
export function wochenSerie(einheiten: Einheit[], jetzt: Date): number {
  const wochen = new Set(einheiten.filter(zaehlt).map(e => wochenStart(Date.parse(e.ended_at ?? e.started_at))))
  wochen.add(wochenStart(jetzt.getTime()))

  let serie = 0
  const tag = new Date(wochenStart(jetzt.getTime()))
  while (wochen.has(tag.getTime())) {
    serie++
    tag.setDate(tag.getDate() - 7)
  }
  return serie
}

/** Länger dauert keine echte Einheit. Was darüber liegt, ist eine
    vergessene: gestartet, nie beendet und Wochen später abgeschlossen —
    in den echten Daten stand dann "838:49 Std." auf dem Abschluss. */
const MAX_MINUTEN = 12 * 60

/** Dauer für die Anzeige, oder null, wenn sie nicht plausibel ist — dann
    steht ein Strich statt einer offensichtlich falschen Zahl. */
export function anzeigeDauer(minuten: number): number | null {
  return minuten > MAX_MINUTEN ? null : minuten
}

/** "1:05" — Stunden und Minuten, wie die Dauer auf dem Abschluss steht. */
export function dauerStunden(minuten: number): string {
  const m = Math.max(0, Math.round(minuten))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
