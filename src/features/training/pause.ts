import { zahlenBereich } from '../../lib/zahlen'

/** Pausenangabe wie "3 min", "90 s" oder "2,5 min" in Sekunden lesen.
    "—" oder leer bedeutet keine Pause (Supersatz-Partner o. Ä.). */
export function pauseSekunden(rest: string | null | undefined): number {
  const s = String(rest ?? '').trim()
  if (!s || s === '—' || s === '-') return 0
  const m = s.match(/([\d,.]+)\s*(min|m|s|sek)?/i)
  if (!m) return 0
  const zahl = parseFloat(m[1].replace(',', '.'))
  if (isNaN(zahl)) return 0
  const einheit = (m[2] || 'min').toLowerCase()
  return einheit.startsWith('s') ? Math.round(zahl) : Math.round(zahl * 60)
}

/** Auswahlbereich fürs Pausen-Zahlrad — überall dort, wo eine Pausenzeit
    als Minutenzahl eingegeben wird (NeueUebungForm, Übungsbibliothek). */
export const PAUSE_MINUTEN = zahlenBereich(0.5, 6, 0.5)

/** Minutenzahl als Pausentext formatiert ("2 min", "2,5 min") — Gegenstück
    zu pauseSekunden() für die Anzeige/Eingabe. */
export function formatPause(min: number): string {
  return (Number.isInteger(min) ? String(min) : min.toFixed(1).replace('.', ',')) + ' min'
}

/** Minutenzahl aus einem Pausentext für die Vorbelegung des Zahlrads —
    Kehrfunktion zu formatPause(), über die vorhandene Sekunden-Auslesung. */
export function pauseMinuten(rest: string | null | undefined): number {
  return Math.round((pauseSekunden(rest) / 60) * 10) / 10
}

const AUTO_PAUSE_KEY = 'benchProtocol.autoPause'

export function autoPauseAn(): boolean {
  return localStorage.getItem(AUTO_PAUSE_KEY) !== 'off'
}

export function setAutoPauseAn(an: boolean) {
  localStorage.setItem(AUTO_PAUSE_KEY, an ? 'on' : 'off')
}
