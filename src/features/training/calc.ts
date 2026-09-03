import type { Exercise, LoggedSet, Plan, TrainingSession } from '../../types/db'
import type { DayWithExercises } from './queries'
import { e1rm, round } from '../bench/calc'
import { geschaetztes1RM } from '../rpeblock/e1rm'

export function mround(n: number, step: number): number {
  return Math.round(n / step) * step
}

const WEEK_LABELS = ['Woche 1', 'Woche 2', 'Woche 3', 'Woche 4 · Deload']

/** Länge eines Bankfokus-Blocks in Wochen. */
export const BLOCK_WOCHEN = 4

/** Welche der vier Blockwochen läuft — 1 bis 4.

    plans.week zählt seit dem Blockwechsel-Umbau durchgehend weiter (5, 6,
    7 …), statt bei jedem neuen Block wieder bei 1 anzufangen. Der Grund
    ist die Historie: logged_sets und sessions sind allein über die
    Wochenzahl eindeutig (unique (exercise_id, week, position) bzw.
    (day_id, week)). Solange die Zahl zurücksprang, kollidierte jeder neue
    Block mit dem alten — und der bisherige Ausweg war, die Daten des
    alten Blocks zu löschen. Mit durchlaufenden Wochen kann sich nichts
    mehr überschneiden, und nichts muss mehr weichen.

    Die Bank-Progression steht dagegen weiterhin als vier Zeilen je Slot in
    der Datenbank und braucht die Position im Block. Genau die liefert
    diese Funktion — sie ist die einzige Stelle, an der aus einer laufenden
    Wochenzahl wieder eine 1–4 wird.

    Voraussetzung ist, dass ein Block genau vier Wochen dauert und die
    Zählung bei 1 begann; beides gilt seit jeher. Die fortlaufende
    Blocknummer bleibt in plans.block stehen und wird nicht hieraus
    abgeleitet — sonst verlören Pläne, die vor dem Umbau schon in Block 3
    standen, ihre Nummer. */
export function blockWoche(week: number): number {
  return ((week - 1) % BLOCK_WOCHEN) + 1
}

/** Bankfokus-Pläne laufen in festen 4-Wochen-Blöcken mit Deload,
    Standardpläne zählen unbegrenzt weiter. */
export function wochenLabel(week: number, plan: Plan): string {
  return plan.typ === 'bench' ? (WEEK_LABELS[blockWoche(week) - 1] ?? `Woche ${week}`) : `Woche ${week}`
}

/** Anzahl geplanter Sätze aus einem Schema wie "4 × 6" oder "4x6" lesen. */
export function setsOf(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/(\d+)\s*[×x*]/i)
  return m ? +m[1] : 3
}

/** Setzt die Satzanzahl in einem Schema neu, ohne den Rest anzufassen:
    "4 × 8" mit 5 wird zu "5 × 8", "3 × 10–12" zu "4 × 10–12".

    Für den Gym-Modus, wo sich beim Training herausstellt, dass es ein Satz
    mehr oder weniger sein soll — der Nutzer wird danach gefragt, ob das in
    den Plan übernommen wird. Passt das Muster nicht (Freitext ohne "×"),
    wird ein sauberes Schema erzeugt statt am Bestehenden herumzuraten. */
export function schemaMitSaetzen(scheme: string | null | undefined, saetze: number): string {
  const text = String(scheme ?? '').trim()
  const m = text.match(/^(\s*)(\d+)(\s*[×x*]\s*)(.*)$/i)
  if (!m) return `${saetze} × ${zielTeil(text) || '10'}`
  return `${m[1]}${saetze}${m[3]}${m[4]}`
}

/** Der Wiederholungsteil eines Schemas ohne die Satzanzahl — "4 × 10–12"
    ergibt "10–12". Nur für schemaMitSaetzen gedacht. */
function zielTeil(scheme: string): string {
  const m = scheme.match(/[×x*]\s*(.+)$/i)
  return m ? m[1].trim() : ''
}

/** Nächste freie Sortier-Nummer: eins über der höchsten vergebenen.

    Vorher wurde schlicht die Anzahl der Einträge genommen. Sobald einer
    gelöscht worden war, traf die Anzahl aber auf eine bereits vergebene
    Nummer — in den echten Daten hatten dadurch zwei Übungen desselben
    Tages dieselbe Nummer. Die Reihenfolge war damit von der Laune der
    Sortierung abhängig, und "nach oben/unten" tauschte zwei gleiche Werte,
    tat also sichtbar nichts. */
export function naechsteSortierung(vorhandene: ReadonlyArray<{ sort_order: number }>): number {
  return vorhandene.reduce((max, e) => Math.max(max, e.sort_order), -1) + 1
}

/** Verschiebt einen Eintrag von einem Platz auf einen anderen und gibt
    die neue Reihenfolge zurück. Die ursprüngliche Liste bleibt unberührt. */
export function umsortieren<T>(liste: readonly T[], von: number, nach: number): T[] {
  const neu = [...liste]
  if (von < 0 || von >= neu.length || nach < 0 || nach >= neu.length || von === nach) return neu
  const [eintrag] = neu.splice(von, 1)
  neu.splice(nach, 0, eintrag)
  return neu
}

/** Welche Einträge nach einem Umsortieren eine neue sort_order brauchen.

    Vergeben wird durchgehend 0, 1, 2 … nach der neuen Reihenfolge, und
    zurückgegeben wird nur, was sich dabei wirklich ändert — jeder
    Eintrag hier wird zu einem eigenen Schreibvorgang, der ohne Netz in
    der Warteschlange landet.

    Durchnummerieren statt nur zwei Werte zu tauschen: Beim Ziehen über
    mehrere Plätze reicht ein Tausch nicht, und eine lückenlose
    Nummerierung schließt nebenbei doppelte Werte aus (siehe
    naechsteSortierung). */
export function neueSortierNummern(
  neueReihenfolge: ReadonlyArray<{ id: string; sort_order: number }>,
): { id: string; sort_order: number }[] {
  return neueReihenfolge
    .map((e, i) => ({ id: e.id, sort_order: i, alt: e.sort_order }))
    .filter(e => e.sort_order !== e.alt)
    .map(({ id, sort_order }) => ({ id, sort_order }))
}

/** Dauer einer Einheit in Minuten, mindestens 1.

    Beide Zeitpunkte kommen von außen und werden nicht mehr im Moment des
    Speicherns gebildet. Das ist der Kern einer offline-fähigen App: Wer
    im Studio ohne Empfang trainiert, dessen "Beenden" liegt bis zu Hause
    in der Warteschlange. Bis dahin hatte die Mutation ihre Endzeit selbst
    gestempelt — die Einheit bekam dann die Dauer bis zum Synchronisieren
    statt bis zum Beenden, aus einer Stunde wurden drei.

    Ungültige oder verdrehte Angaben ergeben 1 statt NaN: Eine unsinnige
    Zahl in der Statistik ist schlimmer als eine offensichtlich zu kurze. */
export function einheitMinuten(startedAt: string, endedAt: string): number {
  const von = Date.parse(startedAt)
  const bis = Date.parse(endedAt)
  if (!Number.isFinite(von) || !Number.isFinite(bis)) return 1
  return Math.max(1, Math.round((bis - von) / 60000))
}

/** Neuer Startzeitpunkt nach einer Pause: Die Pausendauer wird auf den
    Start aufgeschlagen, damit einheitMinuten() sie nicht mitzählt —
    rechnerisch dasselbe wie eine angehaltene Stoppuhr. */
export function startNachPause(startedAt: string, pausedAt: string, jetzt: string): string {
  const pause = Date.parse(jetzt) - Date.parse(pausedAt)
  if (!Number.isFinite(pause) || pause <= 0) return startedAt
  return new Date(Date.parse(startedAt) + pause).toISOString()
}

export function tonnageOf(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + (s.kg && s.reps ? s.kg * s.reps : 0), 0)
}

export interface TagFortschritt {
  geplant: number
  erledigt: number
  tonnage: number
  anteil: number
  fertig: boolean
}

export function tagFortschritt(exercises: Exercise[], setsByExercise: Map<string, LoggedSet[]>): TagFortschritt {
  let geplant = 0
  let erledigt = 0
  let tonnage = 0
  exercises.forEach(ex => {
    geplant += setsOf(ex.scheme)
    const sets = setsByExercise.get(ex.id) ?? []
    erledigt += sets.filter(s => s.done).length
    tonnage += tonnageOf(sets)
  })
  return {
    geplant,
    erledigt,
    tonnage,
    anteil: geplant ? Math.min(1, erledigt / geplant) : 0,
    fertig: geplant > 0 && erledigt >= geplant,
  }
}

/** Gilt ein Trainingstag in dieser Woche als abgehakt? Entweder wurde die
    Einheit beendet oder sie wurde bewusst übersprungen — beides schließt
    den Tag ab. Bewusst nicht über die abgehakten Sätze: wer eine Einheit
    beendet, ohne jeden einzelnen Satz anzuhaken, hat sie trotzdem
    hinter sich. */
export function tagErledigt(dayId: string, sessions: TrainingSession[], week: number): boolean {
  return sessions.some(
    s => s.day_id === dayId && s.week === week && (s.status === 'skipped' || (s.status === 'completed' && s.ended_at != null)),
  )
}

/** Sind alle Trainingstage der laufenden Woche erledigt? Grundlage des
    einheitenbasierten Wochenwechsels: die Woche endet, wenn man sie
    trainiert hat, nicht wenn der Kalender sieben Tage weiter ist — sonst
    zerschneidet eine verschobene Trainingswoche (statt Sonntag mal
    Montag) die laufende Woche mittendrin.

    Ohne Trainingstage nie erledigt: ein leerer Plan würde sonst endlos
    weiterschalten, weil "alle Tage fertig" leer trivial zuträfe. */
export function wocheErledigt(dayIds: string[], sessions: TrainingSession[], week: number): boolean {
  return dayIds.length > 0 && dayIds.every(id => tagErledigt(id, sessions, week))
}

/** Letztes bekanntes Gewicht/Wdh./RPE einer Übung — wochenübergreifend,
    nicht nur aus der aktuell angezeigten Woche. Neuere Woche schlägt
    ältere, innerhalb derselben Woche gewinnt die höhere Position. */
export function letzterSatz(exerciseId: string, alleSaetze: LoggedSet[], vorWoche?: number): LoggedSet | null {
  const treffer = alleSaetze
    .filter(s => s.exercise_id === exerciseId && s.kg != null && (vorWoche == null || s.week <= vorWoche))
    .sort((a, b) => b.week - a.week || b.position - a.position)
  return treffer[0] ?? null
}

/** Dauer je Übung einer Einheit, in Millisekunden: die erste Übung zählt
    ab Trainingsstart, jede weitere ab dem letzten erledigten Satz der
    vorigen Übung — bis zum letzten erledigten Satz dieser Übung selbst.
    Übungen ohne einen erledigten Satz mit Zeitstempel bleiben null und
    verschieben den Anker nicht (die nächste Übung zählt weiter vom
    letzten bekannten Zeitpunkt). */
export function uebungsDauer(exercises: Exercise[], saetze: LoggedSet[], sessionStartIso: string): Map<string, number | null> {
  const dauer = new Map<string, number | null>()
  let anker = new Date(sessionStartIso).getTime()

  exercises.forEach(ex => {
    const zeiten = saetze
      .filter(s => s.exercise_id === ex.id && s.done && s.done_at)
      .map(s => new Date(s.done_at as string).getTime())
    if (!zeiten.length) {
      dauer.set(ex.id, null)
      return
    }
    const letzterSatz = Math.max(...zeiten)
    dauer.set(ex.id, Math.max(0, letzterSatz - anker))
    anker = letzterSatz
  })

  return dauer
}

export interface UebungsDauerSchnitt {
  id: string
  name: string
  minuten: number
}

/** Durchschnittliche Übungsdauer über alle beendeten Einheiten hinweg,
    absteigend sortiert — Grundlage für das Balkendiagramm im Cockpit.
    Übungen ohne einen einzigen erledigten Satz mit Zeitstempel tauchen
    gar nicht auf, statt mit 0 min verzerrend mitgezählt zu werden. */
export function durchschnittsDauerJeUebung(
  days: DayWithExercises[],
  alleSessionen: TrainingSession[],
  alleSaetze: LoggedSet[],
): UebungsDauerSchnitt[] {
  const summeMs = new Map<string, number>()
  const anzahl = new Map<string, number>()
  const nameVon = new Map<string, string>()

  alleSessionen.forEach(session => {
    const tag = days.find(d => d.id === session.day_id)
    if (!tag) return
    const saetzeDerWoche = alleSaetze.filter(s => s.week === session.week && tag.exercises.some(ex => ex.id === s.exercise_id))
    const dauerJeUebung = uebungsDauer(tag.exercises, saetzeDerWoche, session.started_at)
    tag.exercises.forEach(ex => {
      const dauer = dauerJeUebung.get(ex.id)
      if (dauer == null) return
      summeMs.set(ex.id, (summeMs.get(ex.id) ?? 0) + dauer)
      anzahl.set(ex.id, (anzahl.get(ex.id) ?? 0) + 1)
      nameVon.set(ex.id, ex.name)
    })
  })

  return [...summeMs.entries()]
    .map(([id, ms]) => ({
      id,
      name: nameVon.get(id) ?? '—',
      minuten: Math.round((ms / (anzahl.get(id) ?? 1) / 60000) * 10) / 10,
    }))
    .sort((a, b) => b.minuten - a.minuten)
}

/** "3:45" — für kurze Dauern (Sätze, Übungen), nicht ganze Einheiten. */
export function dauerKurz(ms: number): string {
  const gesamtSek = Math.round(ms / 1000)
  const m = Math.floor(gesamtSek / 60)
  const s = gesamtSek % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface AufwaermSatz {
  label: string
  kg: number
  wdh: number
}

const AUFWAERM_STANGE = 20 // leere Langhantel

/** Ob eine Übung die volle Bankdrücken-Aufwärmleiter (mit leerer Stange)
    bekommt: entweder explizit über die Bank-Zuordnung markiert, oder der
    Name verrät es schon — damit muss niemand erst die Bank-Zuordnung
    setzen, nur damit beim Bankdrücken die Stange in der Aufwärmleiter
    auftaucht. */
export function istBankdruecken(exercise: Pick<Exercise, 'bench_slot' | 'name'>): boolean {
  return exercise.bench_slot != null || /bankdr[üu]ck|bench\s*press/i.test(exercise.name)
}

/** Ab welchem Arbeitsgewicht andere Übungen eine Leiter bekommen — als
    Vielfaches der kleinsten Scheibe. Darunter liegen die Prozentstufen so
    dicht am Arbeitsgewicht (und aneinander), dass sie nur Zeilen kosten. */
const LEITER_AB_SCHEIBEN = 4

/** Aufwärmleiter vor dem Arbeitssatz: 50/65/75 % des Arbeitsgewichts,
    beim Bankdrücken davor die leere Stange.

    `mitStange` steht fürs Bankdrücken — dort gehört die leere Langhantel
    dazu, und die Leiter erscheint auch bei leichten Gewichten. Andere
    Übungen bekommen dieselben Prozentstufen ohne Stange, aber erst ab
    einem Arbeitsgewicht, bei dem sich das lohnt. Vorher gingen sie ganz
    leer aus; gefehlt hat das Aufwärmen im Studio bei allem, was schwer
    ist, nicht nur an der Bank.

    Stufen oberhalb des Arbeitsgewichts fallen weg, ebenso Stufen, die auf
    dasselbe Gewicht wie ihre Vorgängerin runden — sonst stünden bei
    kleiner Scheibenstufe zweimal dieselben Kilos untereinander. */
export function aufwaermPlan(mitStange: boolean, kgRoh: number, plate: number): AufwaermSatz[] {
  if (!(kgRoh > 0)) return []
  if (!mitStange && kgRoh <= LEITER_AB_SCHEIBEN * plate) return []

  const auf = (pct: number, wdh: number, label: string): AufwaermSatz => ({
    label,
    wdh,
    kg: Math.max(plate, mround(kgRoh * pct, plate)),
  })

  const stufen = [auf(0.5, 5, '50 %'), auf(0.65, 3, '65 %'), auf(0.75, 1, '75 %')].filter(s => s.kg < kgRoh)
  const leiter = mitStange
    ? [{ label: 'Leere Stange', kg: AUFWAERM_STANGE, wdh: 10 } as AufwaermSatz].concat(
        stufen.filter(s => s.kg > AUFWAERM_STANGE),
      )
    : stufen

  return leiter.filter((s, i) => i === 0 || s.kg > leiter[i - 1].kg)
}

/** Geschätztes 1RM eines einzelnen Satzes — bevorzugt die RPE-Tabelle
    (genauer), fällt außerhalb ihres Bereichs oder ohne RPE auf Epley
    zurück. Dasselbe Muster wie baseE1RM() in bench/calc.ts, hier aber
    für jeden einzelnen Satz statt nur den Plan-Testsatz. */
export function satzE1rm(kg: number | null | undefined, reps: number | null | undefined, rpe: number | null | undefined): number | null {
  if (!kg || !reps) return null
  if (rpe != null) {
    const tab = geschaetztes1RM(kg, reps, rpe)
    if (tab != null) return round(tab, 1)
  }
  return round(e1rm(kg, reps), 1)
}

/** Alle Sätze der letzten Woche vor der aktuellen, in der diese Übung
    Gewichtsdaten hat — für ein sichtbares "Letzte Einheit"-Panel, im
    Unterschied zu letzterSatz() oben, das nur den einen letzten Satz
    für die stille Vorbelegung liefert. */
export function letzteEinheitFuerUebung(exerciseId: string, alleSaetze: LoggedSet[], aktuelleWoche: number): LoggedSet[] {
  const relevante = alleSaetze.filter(s => s.exercise_id === exerciseId && s.week < aktuelleWoche && s.kg != null)
  if (!relevante.length) return []
  const letzteWoche = Math.max(...relevante.map(s => s.week))
  return relevante.filter(s => s.week === letzteWoche).sort((a, b) => a.position - b.position)
}

export interface MuskelgruppenSatz {
  gruppe: string
  saetze: number
}

/** Trainierte Muskelgruppen eines Tages mit ihrer geplanten Satzanzahl,
    absteigend sortiert — Grundlage für die Muskel-Chips auf der
    Tagesansicht. Übungen ohne Muskelgruppen-Angabe bleiben außen vor. */
export function muskelgruppenDesTags(exercises: Exercise[]): MuskelgruppenSatz[] {
  const map = new Map<string, number>()
  exercises.forEach(ex => {
    if (!ex.muscle_group) return
    map.set(ex.muscle_group, (map.get(ex.muscle_group) ?? 0) + setsOf(ex.scheme))
  })
  return [...map.entries()].map(([gruppe, saetze]) => ({ gruppe, saetze })).sort((a, b) => b.saetze - a.saetze)
}

/** Angezeigter Übungsname für die Deload-Woche eines Bankfokus-Plans:
    hängt "(Deload)" an, sobald die Übung einem Bank-Slot zugeordnet ist
    und Woche 4 läuft — egal wie die Übung selbst heißt ("Bankdrücken
    Langhantel", "Bankdrücken mit Pause" oder sonst etwas). Reine Anzeige:
    die hinterlegte Übung (Name, Slot, Schema) bleibt unangetastet, das
    tatsächliche Gewicht/Schema dieser Woche kommt ohnehin aus der
    Bank-Progression (siehe bench/queries.ts benchRowsFor), nicht aus
    diesem Namen. Sonst unverändert der normale Name. */
export function anzeigeName(exercise: Pick<Exercise, 'name' | 'bench_slot'>, plan: Plan, week: number): string {
  if (plan.typ === 'bench' && blockWoche(week) === 4 && exercise.bench_slot) return `${exercise.name} (Deload)`
  return exercise.name
}

export function gruppeSetsByExercise(sets: LoggedSet[]): Map<string, LoggedSet[]> {
  const m = new Map<string, LoggedSet[]>()
  sets.forEach(s => {
    const liste = m.get(s.exercise_id) ?? []
    liste.push(s)
    m.set(s.exercise_id, liste)
  })
  m.forEach(liste => liste.sort((a, b) => a.position - b.position))
  return m
}
