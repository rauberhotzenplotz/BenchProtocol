import type { Exercise, LoggedSet, Plan } from '../../types/db'

export function mround(n: number, step: number): number {
  return Math.round(n / step) * step
}

const WEEK_LABELS = ['Woche 1', 'Woche 2', 'Woche 3', 'Woche 4 · Deload']

/** Bankfokus-Pläne laufen in festen 4-Wochen-Blöcken mit Deload,
    Standardpläne zählen unbegrenzt weiter. */
export function wochenLabel(week: number, plan: Plan): string {
  return plan.typ === 'bench' ? (WEEK_LABELS[week - 1] ?? `Woche ${week}`) : `Woche ${week}`
}

/** Anzahl geplanter Sätze aus einem Schema wie "4 × 6" oder "4x6" lesen. */
export function setsOf(scheme: string | null | undefined): number {
  const m = String(scheme ?? '').match(/(\d+)\s*[×x*]/i)
  return m ? +m[1] : 3
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
const AUFWAERM_SCHWER_AB = 40 // ab hier lohnt eine Rampe auch ohne Bank-Zuordnung

/** Ob eine Übung die volle Bankdrücken-Aufwärmleiter (mit leerer Stange)
    bekommt: entweder explizit über die Bank-Zuordnung markiert, oder der
    Name verrät es schon — damit muss niemand erst die Bank-Zuordnung
    setzen, nur damit beim Bankdrücken die Stange in der Aufwärmleiter
    auftaucht. */
export function istBankdruecken(exercise: Pick<Exercise, 'bench_slot' | 'name'>): boolean {
  return exercise.bench_slot != null || /bankdr[üu]ck|bench\s*press/i.test(exercise.name)
}

/** Aufwärmleiter vor dem Arbeitssatz — fürs Bankdrücken die volle Leiter
    aus der Anleitung (leere Stange, 50/65/75 %), für andere schwere
    Übungen (≥ 40 kg) eine kurze Rampe, für die erste Übung der Einheit
    unabhängig vom Gewicht eine minimale Aufwärmung — man ist noch kalt.
    Leichte, spätere Isolationsübungen bekommen keine. */
export function aufwaermPlan(mitStange: boolean, kgRoh: number, istErste: boolean, plate: number): AufwaermSatz[] {
  if (!(kgRoh > 0)) return []
  const auf = (pct: number, wdh: number, label: string): AufwaermSatz => ({
    label,
    wdh,
    kg: Math.max(plate, mround(kgRoh * pct, plate)),
  })

  if (mitStange) {
    return [{ label: 'Leere Stange', kg: AUFWAERM_STANGE, wdh: 10 }].concat(
      [auf(0.5, 5, '50 %'), auf(0.65, 3, '65 %'), auf(0.75, 1, '75 %')].filter(s => s.kg > AUFWAERM_STANGE),
    )
  }
  if (kgRoh >= AUFWAERM_SCHWER_AB) return [auf(0.5, 5, '50 %'), auf(0.7, 3, '70 %')]
  if (istErste) return [auf(0.5, 8, '50 %')]
  return []
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
