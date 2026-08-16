/** Werteliste von…bis in festen Schritten — rundet auf ganze Hundertstel,
    damit z. B. 0,1 + 0,2 nicht als 0.30000000000000004 landet. */
export function zahlenBereich(von: number, bis: number, schritt: number): number[] {
  const n = Math.round((bis - von) / schritt)
  return Array.from({ length: n + 1 }, (_, i) => Math.round((von + i * schritt) * 100) / 100)
}
