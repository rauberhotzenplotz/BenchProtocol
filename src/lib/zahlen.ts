/** Gewicht in deutscher Schreibweise, bis zu drei Nachkommastellen.

    Drei, weil die Zahleneingabe so viele annimmt (Mikro-Scheiben, siehe
    ZahlRad) — angezeigt wurden sie bis dahin trotzdem nicht: Der
    Gym-Modus rundete auf eine Stelle, die Tagesansicht schrieb den Wert
    unformatiert mit Punkt statt Komma hin. Ein eingetragenes Gewicht, das
    anders dasteht als eingegeben, ist schlimmer als keine Nachkommastelle.

    Nachgestellte Nullen fallen weg: 80 bleibt "80", nicht "80,000". */
export function formatGewicht(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}

/** Werteliste von…bis in festen Schritten — rundet auf ganze Hundertstel,
    damit z. B. 0,1 + 0,2 nicht als 0.30000000000000004 landet. */
export function zahlenBereich(von: number, bis: number, schritt: number): number[] {
  const n = Math.round((bis - von) / schritt)
  // Auf Tausendstel statt Hundertstel: Die Scheibengröße eines Plans darf
  // seit der Umstellung auf drei Nachkommastellen 0,125 sein, und die
  // Liste hätte daraus sonst 0,13 / 0,25 / 0,38 gemacht.
  return Array.from({ length: n + 1 }, (_, i) => Math.round((von + i * schritt) * 1000) / 1000)
}
