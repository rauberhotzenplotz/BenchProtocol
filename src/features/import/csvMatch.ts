/** Namensabgleich über Zeichen-Trigramme (Dice-Koeffizient) — deutsche
    Komposita brechen Wortvergleiche: "Schrägbankdrücken Kurzhanteln"
    gegen "Schrägbank Kurzhantel-Drücken" teilt kein einziges ganzes
    Wort, aber fast alle Trigramme. Portiert aus der alten Single-File-
    App (trainingsplan.html), unverändert in der Logik. */

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[×✕*]/g, 'x')
    .replace(/[‐-―−]/g, '-')
    .replace(/[.,;:()'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trigrams(s: string): Set<string> {
  const t = ' ' + norm(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  const g = new Set<string>()
  for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3))
  return g
}

/** Der CSV-Export nutzt teils deutsche, der Plan teils englische
    Bezeichnungen — beide Seiten werden auf eine gemeinsame Form gebracht. */
const SYN: [RegExp, string][] = [
  [/\bleg ?ext(ensions?)?\b|\bbeinstrecke\w*/g, 'beinstrecken'],
  [/\bleg ?curls?\b|\bbeinbeug\w*/g, 'beinbeugen'],
  [/\bleg ?press\b|\bbeinpresse\b/g, 'beinpresse'],
  [/\bcalf raises?\b|\bwadenhebe\w*/g, 'wadenheben'],
  [/\blat ?pulldowns?\b|\blatzug\b/g, 'latzug'],
  [/\bpull ?ups?\b|\bklimmzug\w*/g, 'klimmzuge'],
  [/\bsquats?\b|\bkniebeuge\w*/g, 'kniebeuge'],
  [/\brows?\b|\brudern\b/g, 'rudern'],
  [/\blateral raises?\b|\bseitheben\b/g, 'seitheben'],
  [/\bpushdowns?\b|\btrizepsdrucken\b|\btrizeps\b/g, 'trizeps'],
  [/\bcrunch(es)?\b/g, 'crunch'],
  [/\bcurls?\b/g, 'curl'],
  [/\bbench ?press\b|\bbankdrucken\b/g, 'bankdrucken'],
  [/\bcable\b|\bkabelzug\b|\bkabel\b/g, 'kabel'],
  [/\bmaschine\b|\bmachine\b|\bgerat\b/g, ''],
]

function synth(s: string): string {
  let t = norm(s).replace(/[^a-z0-9]+/g, ' ')
  SYN.forEach(([r, v]) => {
    t = t.replace(r, v)
  })
  return t.replace(/\s+/g, ' ').trim()
}

/** Sich ausschließende Ausführungen — ohne diese Regel landet "Wadenheben
    im Stehen" auf "Sitzendes Wadenheben", beim Wadentraining genau die
    Unterscheidung, auf die es ankommt. */
const GEGENSATZ = [
  ['stehend', 'stehen', 'standing'],
  ['sitzend', 'sitzen', 'seated'],
  ['liegend', 'liegen', 'lying'],
]

function ausfuehrung(s: string): Set<number> {
  const t = ' ' + synth(s) + ' '
  const g = new Set<number>()
  GEGENSATZ.forEach((grp, i) => {
    if (grp.some(w => t.includes(w))) g.add(i)
  })
  return g
}

function widerspruch(a: string, b: string): boolean {
  const A = ausfuehrung(a)
  const B = ausfuehrung(b)
  if (!A.size || !B.size) return false
  return ![...A].some(x => B.has(x))
}

function simRaw(a: string, b: string): number {
  const A = trigrams(a)
  const B = trigrams(b)
  if (!A.size || !B.size) return 0
  let n = 0
  A.forEach(g => {
    if (B.has(g)) n++
  })
  const dice = (2 * n) / (A.size + B.size)
  const enthalten = n / Math.min(A.size, B.size)
  return Math.max(dice, enthalten * 0.85)
}

/** Der Plan zählt Alternativen auf ("Kniebeuge oder V-Squat") und trägt
    Zusätze in Klammern — gegen jede Variante wird einzeln verglichen. */
function planVarianten(name: string): string[] {
  const ohneKlammer = name.replace(/\([^)]*\)/g, ' ')
  const teile = [ohneKlammer, ...ohneKlammer.split(/\s+oder\s+|\s+o\.\s+|,\s*/i)]
  return [...new Set(teile.map(s => s.trim()).filter(s => s.length > 4))]
}

function similarity(csvName: string, planName: string): number {
  const a = synth(csvName)
  let best = simRaw(a, synth(planName))
  planVarianten(planName).forEach(v => {
    best = Math.max(best, simRaw(a, synth(v)))
  })
  if (widerspruch(csvName, planName)) best *= 0.35
  return best
}

const MATCH_MIN = 0.5 // darunter lieber nicht zuordnen als falsch zuordnen

export interface MatchTreffer<T> {
  csvIndex: number
  ziel: T
  score: number
}

/** Ordnet CSV-Übungsnamen einer Liste von Ziel-Objekten zu — bester
    Treffer zuerst, jedes Ziel wird höchstens einmal belegt. */
export function matchExercises<T>(
  csvNamen: { name: string; gear: string }[],
  ziele: T[],
  zielName: (z: T) => string,
): { treffer: MatchTreffer<T>[]; unmatched: number[] } {
  const paare: { ci: number; zi: number; s: number }[] = []
  csvNamen.forEach((c, ci) => {
    ziele.forEach((z, zi) => {
      const s = similarity(c.name + ' ' + c.gear, zielName(z))
      if (s >= MATCH_MIN) paare.push({ ci, zi, s })
    })
  })
  paare.sort((a, b) => b.s - a.s)

  const cUsed = new Set<number>()
  const zUsed = new Set<number>()
  const treffer: MatchTreffer<T>[] = []
  paare.forEach(pr => {
    if (cUsed.has(pr.ci) || zUsed.has(pr.zi)) return
    cUsed.add(pr.ci)
    zUsed.add(pr.zi)
    treffer.push({ csvIndex: pr.ci, ziel: ziele[pr.zi], score: pr.s })
  })

  const unmatched = csvNamen.map((_, i) => i).filter(i => !cUsed.has(i))
  return { treffer, unmatched }
}
