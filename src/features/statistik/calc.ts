import type { LoggedSet, TrainingSession } from '../../types/db'
import type { DayWithExercises } from '../training/queries'
import { gruppeSetsByExercise, tagFortschritt } from '../training/calc'
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

const TAG_MS = 24 * 60 * 60 * 1000

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

// ── Belastungssteuerung ──────────────────────────────────────────────

export interface Belastung {
  /** Tonnage der letzten 7 Tage. */
  akut: number
  /** Mittlere Wochentonnage der letzten 28 Tage. */
  chronisch: number
  /** Akut geteilt durch chronisch. Über 1,5 heißt: Die Woche fällt weit
      aus dem gewohnten Rahmen. null, solange keine 28 Tage Vorlauf da
      sind — vorher ist der Nenner keine Gewöhnung, sondern Zufall. */
  verhaeltnis: number | null
  /** Monotonie nach Foster: mittlere Tageslast geteilt durch ihre
      Streuung über sieben Tage. Hohe Werte heißen "jeden Tag dasselbe" —
      gleichförmige Belastung gilt als schlechter verkraftbar als eine mit
      schweren und leichten Tagen. */
  monotonie: number | null
  /** Wochenlast mal Monotonie. Fasst beides zu einer Zahl zusammen. */
  strain: number | null
  /** Auf wie vielen Tagen mit Training die Rechnung beruht. */
  tageMitTraining: number
}

/** Belastungskennzahlen aus den Satzprotokollen.

    Als Last dient die Tonnage, nicht das übliche sRPE (Dauer mal
    Anstrengung): Ein RPE tragen hier nur Bankdrücken-Sätze, und eine
    Kennzahl, die je nach Übungsauswahl auf einem anderen Fundament steht,
    wäre schlimmer als eine gröbere. Die Tonnage liegt für jeden
    abgehakten Satz vor.

    Die Verhältniszahl stammt aus der Sportwissenschaft (acute:chronic
    workload ratio) und ist dort umstritten — sie sagt nichts über
    Verletzungen voraus. Als Beschreibung taugt sie trotzdem: Sie zeigt,
    wie weit die laufende Woche von dem abweicht, was der Körper gewohnt
    ist. */
export function belastung(saetze: readonly LoggedSet[], jetzt: number = Date.now()): Belastung {
  const gute = verwertbar(saetze).filter(s => s.done_at)
  const last = (abTagen: number, bisTagen: number) =>
    tonnage(
      gute.filter(s => {
        const alter = (jetzt - Date.parse(s.done_at!)) / TAG_MS
        return alter >= abTagen && alter < bisTagen
      }),
    )

  const akut = last(0, 7)
  const chronischGesamt = last(0, 28)
  const chronisch = chronischGesamt / 4

  // Tageslast der letzten sieben Tage, Ruhetage als Null. Ohne die Nullen
  // wäre die Monotonie nur ein Vergleich der Trainingstage untereinander
  // — gerade die Ruhetage machen aber den Unterschied.
  const jeTag: number[] = []
  for (let d = 0; d < 7; d++) jeTag.push(last(d, d + 1))
  const s = streuung(jeTag)
  const monotonie = s && s.sd > 0 ? s.mittel / s.sd : null
  const wochenlast = jeTag.reduce((a, w) => a + w, 0)

  // 28 Tage Vorlauf verlangen: Ohne sie ist der Nenner kein
  // Gewöhnungswert. Geprüft wird am ältesten Satz überhaupt.
  const aeltester = gute.reduce<number | null>((a, x) => {
    const t = Date.parse(x.done_at!)
    return a == null || t < a ? t : a
  }, null)
  const genugVorlauf = aeltester != null && jetzt - aeltester >= 28 * TAG_MS

  return {
    akut,
    chronisch,
    verhaeltnis: genugVorlauf && chronisch > 0 ? akut / chronisch : null,
    monotonie,
    strain: monotonie != null ? wochenlast * monotonie : null,
    tageMitTraining: jeTag.filter(w => w > 0).length,
  }
}

// ── Verteilungen ─────────────────────────────────────────────────────

export interface Fach {
  name: string
  saetze: number
  anteil: number
}

/** Grenzen der Wiederholungsbereiche, wie sie im Krafttraining üblich
    beschrieben werden. Die Namen sind bewusst die geläufigen Etiketten —
    sie sind eine Einordnung, keine Naturgesetze. */
const WDH_FAECHER: ReadonlyArray<{ name: string; bis: number }> = [
  { name: '1–3 · Maximalkraft', bis: 3 },
  { name: '4–6 · Kraft', bis: 6 },
  { name: '7–12 · Hypertrophie', bis: 12 },
  { name: '13–20 · Kraftausdauer', bis: 20 },
  { name: '21+ · Ausdauer', bis: Infinity },
]

export function wiederholungsVerteilung(saetze: readonly LoggedSet[]): Fach[] {
  const gute = verwertbar(saetze)
  const gesamt = gute.length
  return WDH_FAECHER.map((f, i) => {
    const von = i === 0 ? 1 : WDH_FAECHER[i - 1].bis + 1
    const anzahl = gute.filter(s => (s.reps ?? 0) >= von && (s.reps ?? 0) <= f.bis).length
    return { name: f.name, saetze: anzahl, anteil: gesamt ? anzahl / gesamt : 0 }
  })
}

/** Intensitätszonen als Anteil am besten geschätzten 1RM der jeweiligen
    Übung.

    Bezugspunkt ist das beste e1RM, das für diese Übung je erreicht wurde,
    nicht ein tagesaktuelles: Ein Satz von vor einem halben Jahr soll an
    dem gemessen werden, was damals wie heute die Bestmarke ist. Sonst
    verschöbe jede neue Bestleistung rückwirkend die ganze Geschichte.

    Übungen ohne brauchbaren Bezugswert bleiben außen vor. */
export function intensitaetsZonen(saetze: readonly LoggedSet[], besteE1rm: ReadonlyMap<string, number>): Fach[] {
  const gute = verwertbar(saetze).filter(s => (besteE1rm.get(s.exercise_id) ?? 0) > 0)
  const gesamt = gute.length
  const grenzen = [
    { name: 'unter 60 %', bis: 0.6 },
    { name: '60–70 %', bis: 0.7 },
    { name: '70–80 %', bis: 0.8 },
    { name: '80–90 %', bis: 0.9 },
    { name: '90 %+', bis: Infinity },
  ]
  return grenzen.map((g, i) => {
    const vonAnteil = i === 0 ? 0 : grenzen[i - 1].bis
    const anzahl = gute.filter(s => {
      const anteil = (s.kg ?? 0) / besteE1rm.get(s.exercise_id)!
      return anteil >= vonAnteil && anteil < g.bis
    }).length
    return { name: g.name, saetze: anzahl, anteil: gesamt ? anzahl / gesamt : 0 }
  })
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

/** Wie viele Übungen die Hälfte des Gesamtvolumens ausmachen.

    Eine kleine Zahl heißt: Das Training hängt an wenigen Übungen. Das ist
    weder gut noch schlecht — nur etwas, das man wissen sollte, bevor eine
    davon wegfällt. */
export function schwerpunkt(anteile: readonly UebungsAnteil[]): number | null {
  if (!anteile.length) return null
  let summe = 0
  for (let i = 0; i < anteile.length; i++) {
    summe += anteile[i].anteil
    if (summe >= 0.5) return i + 1
  }
  return anteile.length
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
