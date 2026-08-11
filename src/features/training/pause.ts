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

const AUTO_PAUSE_KEY = 'benchProtocol.autoPause'

export function autoPauseAn(): boolean {
  return localStorage.getItem(AUTO_PAUSE_KEY) !== 'off'
}

export function setAutoPauseAn(an: boolean) {
  localStorage.setItem(AUTO_PAUSE_KEY, an ? 'on' : 'off')
}
