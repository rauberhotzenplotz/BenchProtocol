/* Bestehende Plan-Übungen nachträglich mit dem Katalog verknüpfen.
 *
 * Warum überhaupt: Seit das Cockpit die Muskelbelastung aus dem Katalog
 * rechnet (Haupt-, Sekundär- und Tertiärmuskel, siehe muskelHitze.ts),
 * hängt die Auswertung an exercises.library_id. Übungen, die vor
 * Migration 0011 angelegt oder aus Excel importiert wurden, haben diese
 * Verknüpfung nie bekommen -- am Testgerät waren es 25 von 25. Für sie
 * greift nur der Rückfall auf die von Hand gesetzte Muskelgruppe: eine
 * Fläche statt drei gewichteter.
 *
 * Der Abgleich läuft über den Namen. Er muss mit dem umgehen, was in
 * echten Plänen steht:
 *   "Bankdrücken Langhantel"  gegen  "Langhantel Bankdrücken"   (Wortfolge)
 *   "Klimmzüge"               gegen  "Klimmzug"                 (Mehrzahl)
 *   "T-Bar Rudern"            gegen  "T-Bar-Rudern"             (Bindestrich)
 *   "Seitheben Kabel  (A)"    gegen  "Kabelzug Seitheben"       (Zusätze)
 *
 * Deshalb wird nicht auf Gleichheit geprüft, sondern auf Wortüberdeckung:
 * Jedes Wort des Plannamens muss im Katalognamen vorkommen. Der Eintrag
 * mit den wenigsten überzähligen Wörtern gewinnt -- so schlägt
 * "Langhantel Bankdrücken" das ebenfalls passende "Langhantel
 * Bankdrücken, Untergriff".
 *
 * Grundsatz: Im Zweifel nichts zuordnen. Eine falsche Verknüpfung färbt
 * dauerhaft die falschen Muskeln, eine fehlende kostet nur den Rückfall,
 * den es ohnehin gibt.
 *
 * Ausführung:
 *   node werkzeuge/uebung-zuordnen.mjs <daten.json>
 * Die Datei enthält { uebungen, katalog } und wird über das Kabel aus der
 * laufenden App geholt (der Katalog hängt an RLS, ein eigenständiges
 * Node-Skript käme nicht an die Daten). Ausgegeben wird nur ein
 * Vorschlag -- geschrieben wird nichts.
 */
import { readFileSync } from 'node:fs'

/** Wörter, die nichts zur Unterscheidung beitragen: Sortierbuchstaben aus
    dem Plan ("(A)", "(B)"), Trennwörter und Gerätesynonyme, die im
    Katalog anders heißen. */
const FUELLWORT = /^(a|b|c|d|oder|und|mit|im|der|die|das|deload)$/

/** Gleichbedeutende Schreibweisen. Wird vor dem Vergleich angewandt,
    damit "Kabel" und "Kabelzug" oder "Klimmzüge" und "Klimmzug"
    zueinanderfinden. */
const GLEICH = [
  // Geräte
  [/\bcable\b|\bkabelzug\b|\bkabel\b/g, 'kabel'],
  [/\bbarbell\b|\blh\b/g, 'langhantel'],
  [/\bdumbbell\b|\bkh\b/g, 'kurzhantel'],
  [/\bmaschine\b|\bmachine\b|\bgeraet\b/g, 'maschine'],
  // Bewegungen, deren englische und deutsche Schreibweise nebeneinander
  // in echten Plänen auftauchen
  [/\blegextensions?\b|\bbeinstrecker\b|\bbeinstrecken\b/g, 'beinstreck'],
  [/\blegcurls?\b|\bhamstringcurls?\b|\bbeinbeuger\b|\bbeinbeugen\b/g, 'beinbeug'],
  [/\blegpress\b/g, 'beinpresse'],
  [/\brow\b|\brudern\b/g, 'rudern'],
  [/\bpushdown\b|\btrizepsdruecken\b/g, 'trizepsdruecken'],
  [/\bcalfraise\b/g, 'wadenheben'],
  [/\bhamstring\b/g, 'beinbeug'],
  // Mehrzahl und gebeugte Formen. In Plänen steht "Klimmzüge",
  // "Hammercurls", "Stehendes Wadenheben" — im Katalog "Klimmzug",
  // "Hammercurl", "stehend".
  [/\bklimmzuege\b/g, 'klimmzug'],
  [/\bcurls\b/g, 'curl'],
  [/\bflys\b/g, 'fly'],
  [/\bstehendes?\b|\bstehender\b|\bstehende\b/g, 'stehend'],
  [/\bsitzendes?\b|\bsitzender\b|\bsitzende\b/g, 'sitzend'],
  [/\bliegendes?\b|\bliegender\b|\bliegende\b/g, 'liegend'],
  [/\bkniendes?\b|\bkniender\b|\bkniende\b/g, 'kniend'],
]

/** Vergleichsform eines Namens: klein, ohne Umlaute, ohne Klammern und
    Bindestriche, Synonyme vereinheitlicht, Füllwörter raus. */
export function woerter(name) {
  let t = String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
  for (const [muster, ersatz] of GLEICH) t = t.replace(muster, ersatz)
  return t.split(/\s+/).filter(w => w && !FUELLWORT.test(w))
}

/** Der beste Katalogeintrag für einen Übungsnamen — oder null.

    Verlangt wird, dass jedes Wort des Plannamens im Katalognamen
    vorkommt. Unter den Treffern gewinnt der mit den wenigsten
    überzähligen Wörtern; bei Gleichstand der kürzere Name. Bleiben zwei
    Kandidaten gleich gut, wird nichts zugeordnet -- raten hilft hier
    niemandem. */
export function besterTreffer(name, katalog) {
  const gesucht = woerter(name)
  if (!gesucht.length) return null

  const treffer = []
  for (const e of katalog) {
    const kandidat = woerter(e.name)
    // Substring auf der zusammengezogenen Form, nicht nur Wortgleichheit:
    // Deutsche Komposita fallen sonst auseinander — "Schrägbank
    // Kurzhantel-Drücken" trifft "Kurzhantel Schrägbankdrücken" nur, wenn
    // "schraegbank" und "druecken" auch als Wortteil zählen.
    const zusammen = kandidat.join('')
    if (!gesucht.every(w => kandidat.includes(w) || zusammen.includes(w))) continue
    treffer.push({
      eintrag: e,
      // Wie viele Wörter nur als Wortteil passen. "Klimmzug" steckt auch
      // in "Klimmzugmaschine" — das ist aber eine andere Übung. Ganze
      // Wörter gehen deshalb immer vor.
      nurTeil: gesucht.filter(w => !kandidat.includes(w)).length,
      ueberzaehlig: kandidat.length - gesucht.length,
      laenge: kandidat.length,
    })
  }
  if (!treffer.length) return null

  // Bei gleich guter Passung entscheidet der Bekanntheitsrang: Er steht
  // ohnehin für "das ist die gemeinte Variante" und stellt damit
  // Langhantel vor Kurzhantel vor Exotik. Ohne ihn blieben Kandidaten
  // wie "Langhantel Bankdrücken, mit Pause" und "Kurzhantel Bankdrücken,
  // mit Pause" gleichauf, und es wurde gar nichts zugeordnet.
  treffer.sort(
    (a, b) =>
      a.nurTeil - b.nurTeil ||
      a.ueberzaehlig - b.ueberzaehlig ||
      a.laenge - b.laenge ||
      (a.eintrag.popularity ?? 9999) - (b.eintrag.popularity ?? 9999) ||
      a.eintrag.name.localeCompare(b.eintrag.name),
  )
  const [erster, zweiter] = treffer
  // Nur noch dann nichts zuordnen, wenn zwei Kandidaten in jeder Hinsicht
  // gleich sind — dann ist die Entscheidung wirklich willkürlich.
  if (
    zweiter &&
    zweiter.nurTeil === erster.nurTeil &&
    zweiter.ueberzaehlig === erster.ueberzaehlig &&
    zweiter.laenge === erster.laenge &&
    (zweiter.eintrag.popularity ?? 9999) === (erster.eintrag.popularity ?? 9999)
  ) {
    return null
  }
  return erster.eintrag
}

/** Vorschlag für alle Übungen ohne Verknüpfung. */
export function zuordnen(uebungen, katalog) {
  const zugeordnet = []
  const offen = []
  for (const u of uebungen) {
    if (u.library_id) continue
    const treffer = besterTreffer(u.name, katalog)
    if (treffer) zugeordnet.push({ uebung: u, eintrag: treffer })
    else offen.push(u)
  }
  return { zugeordnet, offen }
}

// ── Hauptlauf ────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('uebung-zuordnen.mjs') && process.argv[2]) {
  const { uebungen, katalog } = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const { zugeordnet, offen } = zuordnen(uebungen, katalog)

  console.log(`Zugeordnet: ${zugeordnet.length} von ${uebungen.filter(u => !u.library_id).length}\n`)
  for (const { uebung, eintrag } of zugeordnet) {
    const gleicheGruppe = (uebung.gruppe ?? '') === (eintrag.gruppe ?? '')
    console.log(
      `  ${uebung.name.padEnd(34)} -> ${eintrag.name.padEnd(38)} ${eintrag.primaer ?? '?'}` +
        (gleicheGruppe ? '' : `   [Gruppe: ${uebung.gruppe ?? '—'} vs ${eintrag.gruppe ?? '—'}]`),
    )
  }
  if (offen.length) {
    console.log(`\nOhne Treffer (bleiben beim Rückfall auf die Muskelgruppe): ${offen.length}`)
    for (const u of offen) console.log(`  ${u.name}   [${u.gruppe ?? '—'}]`)
  }

  console.log('\nZum Anwenden (im WebView der App auszuführen):')
  console.log(JSON.stringify(zugeordnet.map(z => ({ id: z.uebung.id, library_id: z.eintrag.id }))))
}
