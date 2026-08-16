/** Sekunden als "m:ss" — negative Werte (Pause überzogen) als "-m:ss". */
export function zeitText(s: number): string {
  const negativ = s < 0
  const abs = Math.abs(s)
  const m = Math.floor(abs / 60)
  const r = abs % 60
  return (negativ ? '-' : '') + `${m}:${String(r).padStart(2, '0')}`
}
