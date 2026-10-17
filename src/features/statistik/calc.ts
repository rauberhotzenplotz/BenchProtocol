import type { LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { gruppeSetsByExercise, tagFortschritt, satzE1rm } from '../training/calc'
import { tagFarbe } from '../training/dayColor'

/* Rechenschicht des Statistik-Tabs.
 *
 * Alles hier ist rein: Eingabe rein, Zahlen raus, kein Datum aus der
 * Systemuhr ohne Übergabe, kein Zugriff auf Cache oder DOM. Das ist keine
 * Formsache — ein Auswertungsfehler fällt in einer Grafik nicht auf, er
 * sieht nur nach einer anderen Aussage aus. Prüfbar muss er sein.
 *
 * Grundsatz für alle Kennzahlen: Was sich aus den Daten nicht ableiten
 * lässt, wird nicht geschätzt, sondern gibt null zurück. Eine leere
 * Stelle ist ehrlich, eine erfundene Zahl im Gewand einer Messung nicht.
 */

// ── Grundlagen ───────────────────────────────────────────────────────

/** Nur die Sätze, die wirklich abgehakt wurden und Gewicht wie
    Wiederholungen tragen. Alles andere ist für jede Auswertung wertlos:
    ein offener Satz sagt nichts, und ein abgehakter ohne Zahlen zählt
    zwar als geleistete Arbeit, lässt sich aber nicht gewichten. */
export function verwertbar(saetze: readonly LoggedSet[]): LoggedSet[] {
  return saetze.filter(s => s.done && s.kg != null && s.reps != null && s.kg > 0 && s.reps > 0)
}

export function tonnage(saetze: readonly LoggedSet[]): number {
  return saetze.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0)
}

export interface Streuung {
  mittel: number
  /** Standardabweichung der Grundgesamtheit (durch n, nicht n−1): Die
      Werte sind hier keine Stichprobe aus etwas Größerem, sondern genau
      die Einheiten, die stattgefunden haben. */
  sd: number
  /** Variationskoeffizient — Streuung im Verhältnis zum Mittel. Erst der
      macht zwei Zeiträume vergleichbar: 200 kg Streuung sind bei 2 t
      Wochenvolumen viel und bei 20 t wenig. null, wenn das Mittel 0 ist. */
  vk: number | null
}

export function streuung(werte: readonly number[]): Streuung | null {
  if (!werte.length) return null
  const mittel = werte.reduce((a, w) => a + w, 0) / werte.length
  const varianz = werte.reduce((a, w) => a + (w - mittel) ** 2, 0) / werte.length
  const sd = Math.sqrt(varianz)
  return { mittel, sd, vk: mittel > 0 ? sd / mittel : null }
}

export interface Punkt {
  x: number
  y: number
}

export interface Regression {
  /** Änderung von y je Schritt auf der x-Achse. */
  steigung: number
  achsenabschnitt: number
  /** Bestimmtheitsmaß: Anteil der Streuung, den die Gerade erklärt.
      Ohne ihn wäre die Steigung eine Behauptung — 0,5 kg pro Woche aus
      drei zufällig verteilten Punkten heißt nichts. */
  r2: number
  n: number
}

/** Ausgleichsgerade nach kleinsten Quadraten.

    Gibt null zurück, wenn weniger als drei Punkte vorliegen oder alle auf
    derselben x-Stelle liegen. Zwei Punkte ergeben immer eine perfekte
    Gerade mit r² = 1 — eine Aussage, die keine ist. */
export function regression(punkte: readonly Punkt[]): Regression | null {
  const n = punkte.length
  if (n < 3) return null
  const mx = punkte.reduce((a, p) => a + p.x, 0) / n
  const my = punkte.reduce((a, p) => a + p.y, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const p of punkte) {
    sxy += (p.x - mx) * (p.y - my)
    sxx += (p.x - mx) ** 2
    syy += (p.y - my) ** 2
  }
  if (sxx === 0) return null
  const steigung = sxy / sxx
  return {
    steigung,
    achsenabschnitt: my - steigung * mx,
    // Liegen alle y gleich, erklärt die (waagerechte) Gerade alles.
    r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
    n,
  }
}

// ── Wochenreihe ──────────────────────────────────────────────────────

export interface WochenWert {
  woche: number
  tonnage: number
  saetze: number
  wiederholungen: number
  einheiten: number
  minuten: number
  /** Mittleres RPE der Woche — null, wenn kein Satz eines trägt. Nur
      Bankdrücken-Sätze bringen eines mit (siehe SetRow/GymModeAP). */
  rpeSchnitt: number | null
}

/** Eine Zeile je Trainingswoche, lückenlos von der ersten bis zur
    letzten Woche mit Daten.

    Lückenlos ist Absicht: Eine ausgefallene Woche ist ein Ergebnis und
    gehört als Null in die Reihe. Ließe man sie weg, rückten die
    Nachbarwochen zusammen und aus einer Trainingspause würde optisch eine
    durchgehende Linie. */
export function wochenReihe(saetze: readonly LoggedSet[], sessions: readonly TrainingSession[]): WochenWert[] {
  const gute = verwertbar(saetze)
  const beendet = sessions.filter(s => s.status === 'completed' && s.ended_at)
  const wochen = [...gute.map(s => s.week), ...beendet.map(s => s.week)]
  if (!wochen.length) return []

  const von = Math.min(...wochen)
  const bis = Math.max(...wochen)
  const reihe: WochenWert[] = []
  for (let w = von; w <= bis; w++) {
    const ws = gute.filter(s => s.week === w)
    const we = beendet.filter(s => s.week === w)
    const mitRpe = ws.filter(s => s.rpe != null)
    reihe.push({
      woche: w,
      tonnage: tonnage(ws),
      saetze: ws.length,
      wiederholungen: ws.reduce((a, s) => a + (s.reps ?? 0), 0),
      einheiten: we.length,
      minuten: we.reduce((a, s) => a + (s.minutes ?? 0), 0),
      rpeSchnitt: mitRpe.length ? mitRpe.reduce((a, s) => a + (s.rpe ?? 0), 0) / mitRpe.length : null,
    })
  }
  return reihe
}

// ── Verteilungen ─────────────────────────────────────────────────────

/** Hintergrundband einer Verteilungskurve, von–bis in Einheiten der
    x-Achse (halboffen: von einschließlich, bis ausschließlich). */
export interface Band {
  von: number
  bis: number
  name: string
  /** Steht, wenn das Band für den Namen zu schmal ist. */
  kurz: string
}

/** Die Wiederholungsbereiche als Bänder. Grenzen auf halben Zahlen, damit
    jede ganze Wiederholungszahl mittig in ihrem Band liegt — 3 Wdh. stehen
    bei 3, das Band "Maximalkraft" reicht von 0,5 bis 3,5. */
export const WDH_BAENDER: readonly Band[] = [
  { von: 0.5, bis: 3.5, name: 'Maximalkraft', kurz: 'Max.' },
  { von: 3.5, bis: 6.5, name: 'Kraft', kurz: 'Kraft' },
  { von: 6.5, bis: 12.5, name: 'Hypertrophie', kurz: 'Hypertr.' },
  { von: 12.5, bis: 20.5, name: 'Kraftausdauer', kurz: 'K-Ausd.' },
  { von: 20.5, bis: 1000, name: 'Ausdauer', kurz: 'Ausd.' },
]

/** Die klassischen Intensitätszonen in Prozent, nur als Hintergrund der
    Intensitätskurve. Bewusst ohne Begriffe wie "Hypertrophie": Die
    Prozente beziehen sich auf das beste e1RM, ein lockerer Satz mit
    8 Wiederholungen landete so bei 62 % und hiesse "Kraftausdauer". Das
    Trainingsziel zeigen die Wiederholungsbereiche. */
export const INTENSITAETS_BAENDER: readonly Band[] = [
  { von: 0, bis: 60, name: '<60', kurz: '<60' },
  { von: 60, bis: 70, name: '60–70', kurz: '60–70' },
  { von: 70, bis: 80, name: '70–80', kurz: '70–80' },
  { von: 80, bis: 90, name: '80–90', kurz: '80–90' },
  { von: 90, bis: 1000, name: '90+', kurz: '90+' },
]

/** Wie viele Sätze mit wie vielen Wiederholungen liefen — ein Punkt je
    Wiederholungszahl, die überhaupt vorkam, aufsteigend. Wie bei der
    Intensitätskurve keine Nullen dazwischen: 11 Wdh. nie gemacht ist eine
    Lücke, keine Messung. */
export function wiederholungsKurve(saetze: readonly LoggedSet[]): { wdh: number; saetze: number }[] {
  const zaehler = new Map<number, number>()
  for (const s of verwertbar(saetze)) {
    if (!s.reps || s.reps < 1) continue
    zaehler.set(s.reps, (zaehler.get(s.reps) ?? 0) + 1)
  }
  return [...zaehler.entries()].sort((a, b) => a[0] - b[0]).map(([wdh, anzahl]) => ({ wdh, saetze: anzahl }))
}

export interface IntensitaetsPunkt {
  /** Ganze Prozent vom besten e1RM der Übung. */
  prozent: number
  saetze: number
}

/** Wie viele Sätze bei welcher Intensität liefen — je ganzem Prozent vom
    besten e1RM ein Punkt. Bezugswert ist das beste e1RM, das für die
    Übung je erreicht wurde — nicht ein tagesaktuelles, sonst verschöbe jede
    neue Bestleistung rückwirkend die ganze Geschichte. Fein statt in fünf
    Zonen gebündelt: Die Kurve zeigt, wo das Training wirklich liegt.

    Zwei Maße zur Wahl:
    - `last`: Gewicht geteilt durch das beste e1RM — wie schwer die Hantel
      war, ohne Rücksicht auf die Wiederholungen.
    - `anstrengung`: das geschätzte 1RM des Satzes selbst geteilt durch
      das beste — wie nah der Satz an die Bestleistung kam. 10 Wdh. mit
      75 % bis zum Versagen sind hier fast 100 %, unter `last` nur 75 %.

    Nur Prozente, bei denen tatsächlich Sätze liefen, aufsteigend. Ein
    Prozent ohne Satz ist keine Messung von null, sondern eine Lücke: Mit
    Nullen dazwischen fiel die Kurve bei jeder Lücke auf den Boden und sah
    aus wie ein Kamm, obwohl die Gewichte nur in Scheibenstufen springen. */
export type IntensitaetsArt = 'last' | 'anstrengung'

export function intensitaetsKurve(
  saetze: readonly LoggedSet[],
  besteE1rm: ReadonlyMap<string, number>,
  art: IntensitaetsArt = 'last',
): IntensitaetsPunkt[] {
  const zaehler = new Map<number, number>()
  for (const s of verwertbar(saetze)) {
    const bezug = besteE1rm.get(s.exercise_id) ?? 0
    if (!(bezug > 0) || !s.kg) continue
    const zaehlwert = art === 'last' ? s.kg : satzE1rm(s.kg, s.reps, s.rpe)
    if (zaehlwert == null) continue
    const p = Math.round((zaehlwert / bezug) * 100)
    zaehler.set(p, (zaehler.get(p) ?? 0) + 1)
  }
  return [...zaehler.entries()].sort((a, b) => a[0] - b[0]).map(([prozent, anzahl]) => ({ prozent, saetze: anzahl }))
}

export interface GeglaetteterPunkt {
  prozent: number
  /** Geglättete Satzzahl an dieser Stelle — kein ganzer Satz mehr,
      sondern wie viele Sätze hier "im Schnitt der Nachbarschaft" liegen. */
  wert: number
}

/** Glättet die Intensitätskurve mit einem Gauß-Kern: Jeder Prozentpunkt
    verteilt seine Sätze glockenförmig auf die Nachbarn, `bandbreite` ist
    die Standardabweichung in Prozentpunkten.

    Warum überhaupt: Die Gewichte springen in Scheibenstufen — 2,5 kg auf
    85 kg sind rund 3 % —, also können manche Prozente kaum vorkommen,
    und die rohe Kurve wird zum Kamm. Geglättet zeigt sie, wo das Training
    liegt und wie breit es streut.

    Die Summe bleibt erhalten: Zusammengezählt ergeben die geglätteten
    Werte so viele Sätze wie die rohen. Ausgewertet wird lückenlos je
    ganzem Prozent, von zwei Bandbreiten unter dem kleinsten bis zwei über
    dem größten belegten Wert — dort ist der Kern praktisch abgeklungen. */
export function glaetten(
  punkte: readonly IntensitaetsPunkt[],
  bandbreite = 2,
  /** Obergrenze, über die nichts hinausgehen kann — bei der Intensität
      100 %, denn kein Satz liegt über der eigenen Bestleistung. Was der
      Kern darüber hinaus verteilen würde, wird an der Grenze gespiegelt
      statt abgeschnitten: So bleiben alle Sätze erhalten, und eine Spitze
      genau bei 100 % rutscht nicht künstlich nach links. */
  grenze?: number,
): GeglaetteterPunkt[] {
  if (!punkte.length) return []
  const reichweite = Math.ceil(bandbreite * 3)
  // Kern über ganze Prozente auf Summe 1 normiert, damit die Glättung
  // keine Sätze erfindet oder verliert.
  const kern: number[] = []
  for (let d = -reichweite; d <= reichweite; d++) kern.push(Math.exp(-(d * d) / (2 * bandbreite * bandbreite)))
  const summe = kern.reduce((a, k) => a + k, 0)
  const gewicht = (d: number) => (Math.abs(d) > reichweite ? 0 : kern[d + reichweite] / summe)

  const von = Math.max(0, punkte[0].prozent - Math.ceil(bandbreite * 2))
  const ohneGrenze = punkte[punkte.length - 1].prozent + Math.ceil(bandbreite * 2)
  const bis = grenze != null ? Math.min(grenze, ohneGrenze) : ohneGrenze
  const ergebnis: GeglaetteterPunkt[] = []
  for (let p = von; p <= bis; p++) {
    const wert = punkte.reduce((a, q) => {
      // Gespiegelter Anteil: der Teil der Glocke, der jenseits der Grenze
      // läge, fällt diesseits wieder an. Gespiegelt wird zwischen den
      // ganzen Prozenten — die Grenze selbst gehört noch dazu, 101 landet
      // auf 100, 102 auf 99. Um die Grenze statt dazwischen gespiegelt,
      // würde die Grenzstelle doppelt gezählt und die Spitze nach links
      // geschoben.
      const spiegel = grenze != null ? gewicht(p - (2 * grenze + 1 - q.prozent)) : 0
      return a + q.saetze * (gewicht(p - q.prozent) + spiegel)
    }, 0)
    ergebnis.push({ prozent: p, wert })
  }
  return ergebnis
}

// ── Rhythmus ─────────────────────────────────────────────────────────

export interface Wochentag {
  /** 0 = Montag … 6 = Sonntag. */
  tag: number
  name: string
  einheiten: number
  minuten: number
}

const TAG_NAMEN = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** An welchen Wochentagen trainiert wird. Zeigt den Rhythmus, den man
    selbst nicht bemerkt — etwa dass der Freitag seit Monaten ausfällt. */
export function wochentagsMuster(sessions: readonly TrainingSession[]): Wochentag[] {
  const beendet = sessions.filter(s => s.status === 'completed' && s.ended_at)
  return TAG_NAMEN.map((name, tag) => {
    // getDay() zählt ab Sonntag, hier wird ab Montag gezählt.
    const dazu = beendet.filter(s => (new Date(s.started_at).getDay() + 6) % 7 === tag)
    return {
      tag,
      name,
      einheiten: dazu.length,
      minuten: dazu.reduce((a, s) => a + (s.minutes ?? 0), 0),
    }
  })
}

/** Längste Folge aufeinanderfolgender Kalenderwochen mit mindestens einer
    beendeten Einheit, und die aktuell laufende Folge.

    Gezählt werden Wochen, nicht Tage: Eine Serie über Tage bricht bei
    jedem normalen Ruhetag ab und misst nichts. */
export function serien(sessions: readonly TrainingSession[]): { laengste: number; aktuell: number } {
  const wochen = [
    ...new Set(sessions.filter(s => s.status === 'completed' && s.ended_at).map(s => s.week)),
  ].sort((a, b) => a - b)
  if (!wochen.length) return { laengste: 0, aktuell: 0 }

  let laengste = 1
  let lauf = 1
  for (let i = 1; i < wochen.length; i++) {
    lauf = wochen[i] === wochen[i - 1] + 1 ? lauf + 1 : 1
    laengste = Math.max(laengste, lauf)
  }
  return { laengste, aktuell: lauf }
}

// ── Übungen ──────────────────────────────────────────────────────────

export interface UebungsAnteil {
  id: string
  name: string
  tonnage: number
  saetze: number
  anteil: number
}

/** Übungen nach Volumenanteil, absteigend. Die Frage dahinter: Wo geht
    die Arbeit eigentlich hin? Meist stecken zwei Drittel des Volumens in
    einer Handvoll Übungen, und welche das sind, überrascht regelmäßig. */
export function uebungsAnteile(
  saetze: readonly LoggedSet[],
  namen: ReadonlyMap<string, string>,
): UebungsAnteil[] {
  const gute = verwertbar(saetze)
  const gesamt = tonnage(gute)
  const jeUebung = new Map<string, { tonnage: number; saetze: number }>()
  for (const s of gute) {
    const stand = jeUebung.get(s.exercise_id) ?? { tonnage: 0, saetze: 0 }
    stand.tonnage += (s.kg ?? 0) * (s.reps ?? 0)
    stand.saetze += 1
    jeUebung.set(s.exercise_id, stand)
  }
  return [...jeUebung.entries()]
    .map(([id, w]) => ({
      id,
      name: namen.get(id) ?? 'Unbekannt',
      tonnage: w.tonnage,
      saetze: w.saetze,
      anteil: gesamt > 0 ? w.tonnage / gesamt : 0,
    }))
    .sort((a, b) => b.tonnage - a.tonnage)
}

// ── Einheiten ────────────────────────────────────────────────────────

export interface EinheitPunkt {
  sessionId: string
  datumLabel: string
  wochenLabel: string
  tagName: string
  minuten: number
  tonnage: number
  erledigt: number
  geplant: number
  farbe: string
}

/** Die letzten `max` beendeten Einheiten mit Dauer und Tonnage — Grundlage
    für die Balkendiagramme "Trainingsdauer"/"Tonnage je Einheit". */
export function einheitenDaten(
  days: DayWithExercises[],
  sessions: TrainingSession[],
  alleSaetze: LoggedSet[],
  max = 14,
): EinheitPunkt[] {
  const abgeschlossen = sessions
    .filter(s => s.status === 'completed' && s.minutes != null)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .slice(-max)

  return abgeschlossen.map(s => {
    const tag = days.find(d => d.id === s.day_id)
    const saetzeDerWoche = tag ? alleSaetze.filter(x => x.week === s.week && tag.exercises.some(ex => ex.id === x.exercise_id)) : []
    const f = tag ? tagFortschritt(tag.exercises, gruppeSetsByExercise(saetzeDerWoche)) : { geplant: 0, erledigt: 0, tonnage: 0, anteil: 0, fertig: false }
    return {
      sessionId: s.id,
      datumLabel: new Date(s.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      wochenLabel: `W${s.week}`,
      tagName: tag?.name ?? '—',
      minuten: s.minutes ?? 0,
      tonnage: f.tonnage,
      erledigt: f.erledigt,
      geplant: f.geplant,
      farbe: tagFarbe(days, s.day_id),
    }
  })
}

// ── Darstellung ──────────────────────────────────────────────────────

/** Y-Achsenteilung: runde Schritte statt der exakten Spanne.

    Eine Achse, die bei 17 483 endet, liest niemand. Gesucht wird der
    kleinste Schritt aus 1/2/5 mal Zehnerpotenz, der mit höchstens so
    vielen Strichen über den Bereich kommt. Steht hier und nicht
    beim Diagramm, weil eine Datei mit Komponenten nur Komponenten
    ausgeben soll (Fast-Refresh-Regel) -- und weil sie so pruefbar ist. */
export function achsenTeilung(hoch: number, striche = 4): number {
  if (!(hoch > 0)) return 1
  const roh = hoch / striche
  const potenz = 10 ** Math.floor(Math.log10(roh))
  // 2,5 gehoert dazu: Ohne sie bekaeme ein 100er-Bereich 50er-Schritte
  // und damit nur zwei Linien -- richtig, aber unnoetig grob.
  for (const f of [1, 2, 2.5, 5, 10]) {
    if (f * potenz >= roh) return f * potenz
  }
  return 10 * potenz
}
