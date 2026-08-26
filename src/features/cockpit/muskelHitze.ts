import type { LoggedSet } from '../../types/db'
import type { DayWithExercises } from '../training/queries'

/** Wie lange eine Gruppe braucht, bis sie im Modell wieder ganz kühl
    steht. Eine volle Trainingswoche: Bei einer kürzeren Strecke stand
    nach dem ersten Ruhetag schon fast alles am kalten Ende, und aus dem
    langsamen Auskühlen wurde ein Umschalten. */
export const ERHOLUNG_TAGE = 7

/** Fenster, über das die Last gezählt wird. */
export const LAST_TAGE = 7

const TAG_MS = 24 * 60 * 60 * 1000

function normalisieren(text: string): string {
  return text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}

/** Freitext-Muskelgruppe → Flächen im Körpermodell.

    Die Gruppen kommen aus dem Volumen-Kontrollblatt des Nutzers und
    heißen dort, wie er sie genannt hat ("Schulter seitlich", "Lat").
    Deshalb über Wortbestandteile statt über eine feste Liste.

    Eine Gruppe kann mehrere Flächen einfärben: "Waden" trifft im Modell
    den Wadenmuskel und beide Schollenmuskeln. Trifft sie gar nichts
    (Hüftbeuger, Schienbeine — im Modell nicht vorgesehen), bleibt sie
    außen vor, statt irgendwo hilfsweise mitzuleuchten. */
export function modellFlaechenFuer(muskelgruppe: string): string[] {
  const t = normalisieren(muskelgruppe)

  // Die hintere Schulter zuerst, und eigenständig geprüft: Sie heißt oft
  // nach der Übung statt nach dem Muskel ("Reverse Flys") und trägt dann
  // weder "Schulter" noch "Delt" im Namen. Alles übrige Schulterhafte
  // gehört zur vorderen Kappe.
  if (/hinte[nr]|rear|revers/.test(t) && /schulter|delt|fly|flie/.test(t)) return ['back-deltoids']
  if (/schulter|delt/.test(t)) return ['front-deltoids']
  if (/unterer? ruecken|lower.?back|lendenwirbel/.test(t)) return ['lower-back']
  if (/ruecken|\blat\b|latissimus|rhombo/.test(t)) return ['upper-back']
  if (/trapez/.test(t)) return ['trapezius']
  if (/brust|pec/.test(t)) return ['chest']
  if (/trizeps/.test(t)) return ['triceps']
  if (/bizeps/.test(t)) return ['biceps']
  if (/unterarm|griff/.test(t)) return ['forearm']
  if (/schraeg|oblique|seitliche[rs]? bauch/.test(t)) return ['obliques']
  if (/bauch|core|rumpf/.test(t)) return ['abs']
  if (/gesaess|glute|po\b/.test(t)) return ['gluteal']
  if (/quadrizeps|\bquad|oberschenkel vorne/.test(t)) return ['quadriceps']
  if (/beinbeuger|hamstring|oberschenkel hinten/.test(t)) return ['hamstring']
  if (/wade|calf/.test(t)) return ['calves', 'left-soleus', 'right-soleus']
  if (/adduktor/.test(t)) return ['adductor']
  if (/abduktor/.test(t)) return ['abductors']
  return []
}

export interface FlaechenHitze {
  /** Tage seit dem letzten abgehakten Satz dieser Fläche. */
  tage: number
  /** Abgehakte Sätze im Zählfenster. */
  saetze: number
}

export interface MuskelHitze {
  /** Je Modellfläche der Zustand; Flächen ohne Daten fehlen hier. */
  flaechen: Map<string, FlaechenHitze>
  /** Je Muskelgruppe des Nutzers, für die Aufstellung darunter. */
  gruppen: { name: string; tage: number; saetze: number }[]
  /** Wie viele Gruppen in den letzten 48 Stunden gereizt wurden. */
  frischeGruppen: number
}

/** Belastung und Erholung je Muskelgruppe aus den Satzprotokollen.

    Beide Größen stehen tatsächlich in den Daten: Die Last sind die
    abgehakten Sätze im Zählfenster, die Erholung ist die Zeit seit dem
    letzten Haken (logged_sets.done_at). Nichts davon ist geschätzt.

    Sätze ohne done_at zählen zur Last, aber nicht zur Erholung — sie
    stammen aus der Zeit vor Migration 0002 und hätten sonst ein Datum,
    das es nie gab. */
export function muskelHitze(
  days: DayWithExercises[],
  alleSaetze: LoggedSet[],
  jetzt: number = Date.now(),
): MuskelHitze {
  const gruppeJeUebung = new Map<string, string>()
  for (const tag of days) {
    for (const ex of tag.exercises) {
      if (ex.muscle_group) gruppeJeUebung.set(ex.id, ex.muscle_group)
    }
  }

  const jeGruppe = new Map<string, { saetze: number; zuletzt: number | null }>()
  for (const s of alleSaetze) {
    if (!s.done) continue
    const gruppe = gruppeJeUebung.get(s.exercise_id)
    if (!gruppe) continue
    const stand = jeGruppe.get(gruppe) ?? { saetze: 0, zuletzt: null }
    const zeit = s.done_at ? Date.parse(s.done_at) : NaN
    if (!Number.isNaN(zeit)) {
      if (jetzt - zeit <= LAST_TAGE * TAG_MS) stand.saetze += 1
      if (stand.zuletzt == null || zeit > stand.zuletzt) stand.zuletzt = zeit
    }
    jeGruppe.set(gruppe, stand)
  }

  const flaechen = new Map<string, FlaechenHitze>()
  const gruppen: MuskelHitze['gruppen'] = []
  let frischeGruppen = 0

  for (const [name, stand] of jeGruppe) {
    if (stand.zuletzt == null) continue
    const tage = Math.max(0, (jetzt - stand.zuletzt) / TAG_MS)
    gruppen.push({ name, tage, saetze: stand.saetze })
    if (tage <= 2) frischeGruppen += 1
    for (const flaeche of modellFlaechenFuer(name)) {
      // Färben zwei Gruppen dieselbe Fläche (etwa "Rücken" und "Lat"),
      // gewinnt der frischere Reiz — er ist der, der noch nachwirkt.
      const bisher = flaechen.get(flaeche)
      if (!bisher || tage < bisher.tage) flaechen.set(flaeche, { tage, saetze: stand.saetze })
    }
  }

  gruppen.sort((a, b) => a.tage - b.tage || b.saetze - a.saetze)
  return { flaechen, gruppen, frischeGruppen }
}

/** Frische einer Fläche: 1 direkt nach dem Reiz, 0 nach einer Woche.
    Steuert, wie stark sie leuchtet — die Farbe allein trägt das nicht. */
export function frischeVon(tage: number): number {
  return Math.max(0, 1 - tage / ERHOLUNG_TAGE)
}

/* Die Farbrampe. Alle Stützpunkte sind Bestandsfarben der App: --magenta,
   --violet, und als kühles Ende deren Mitte mit --neon. Türkis allein
   liest sich grün, Violett allein bleibt zu warm — gemischt ergeben die
   beiden ein helles Blau, ohne eine neue Farbe ins Haus zu holen. */
const MAGENTA = [255, 77, 157]
const VIOLETT = [139, 124, 255]
const TUERKIS = [53, 240, 208]

function mischen(a: number[], b: number[], t: number): number[] {
  const k = Math.min(1, Math.max(0, t))
  return a.map((v, i) => Math.round(v + (b[i] - v) * k))
}
const rgb = (c: number[]) => `rgb(${c.join(',')})`

const HELLBLAU = mischen(TUERKIS, VIOLETT, 0.5)

/** Tage seit dem letzten Reiz → Farbe. Die Strecke ist die
    Erholungsdauer aus muskelHitze.ts, damit Farbe und Leuchtkraft
    dieselbe Zeitachse benutzen. */
export function hitzeFarbe(tage: number): string {
  if (tage >= ERHOLUNG_TAGE) return rgb(HELLBLAU)
  const mitte = ERHOLUNG_TAGE * 0.43
  if (tage >= mitte) return rgb(mischen(VIOLETT, HELLBLAU, (tage - mitte) / (ERHOLUNG_TAGE - mitte)))
  return rgb(mischen(MAGENTA, VIOLETT, tage / mitte))
}

/** Dieselbe Farbe, nur durchscheinend — für Ränder, die den Ton nur
    andeuten sollen. Eigene Funktion, weil sich an eine rgb()-Angabe kein
    Hex-Suffix hängen lässt: "rgb(96,182,232)55" ist ungültiges CSS und
    wird stillschweigend verworfen. */
export function hitzeFarbeBlass(tage: number, deckkraft: number): string {
  return hitzeFarbe(tage).replace('rgb(', 'rgba(').replace(')', `, ${deckkraft})`)
}
