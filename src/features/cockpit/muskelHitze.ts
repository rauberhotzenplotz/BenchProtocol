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

/** Die Muskelangaben eines Katalogeintrags. Namen sind anatomisch und
    lateinisch ("Pectoralis Major"), so wie sie in exercise_library
    stehen. */
export interface KatalogMuskeln {
  muscle_group: string | null
  primary_muscle: string | null
  secondary_muscle: string | null
  tertiary_muscle: string | null
}

/** Wie stark ein Muskel an einer Übung beteiligt ist.

    Der Hauptmuskel zählt voll, der sekundäre halb, der tertiäre ein
    Viertel. Bewusst grob: Der Katalog nennt nur die Reihenfolge, keine
    Anteile — jede feinere Zahl wäre erfunden. Die Abstufung reicht, damit
    die Brust beim Bankdrücken deutlich heller leuchtet als der Trizeps,
    statt wie bisher gleich hell oder (ohne Muskelgruppe) gar nicht. */
export const ANTEIL_PRIMAER = 1
export const ANTEIL_SEKUNDAER = 0.5
export const ANTEIL_TERTIAER = 0.25

/** Anatomischer Muskelname → Flächen im Körpermodell.

    Gegenstück zu modellFlaechenFuer(), das den Freitext des Nutzers
    übersetzt. Diese Liste ist dagegen geschlossen: Sie deckt genau die
    Namen ab, die im Katalog vorkommen. Was das Modell nicht kennt
    (Iliopsoas, Tibialis Anterior), bleibt außen vor, statt hilfsweise
    irgendwo mitzuleuchten. */
export function flaechenFuerMuskel(muskel: string): string[] {
  const t = muskel.trim().toLowerCase()
  if (t.startsWith('pectoralis')) return ['chest']
  if (t.startsWith('latissimus')) return ['upper-back']
  if (t.startsWith('rhomboid') || t.startsWith('levator')) return ['upper-back']
  if (t.includes('trapezius')) return ['trapezius']
  if (t.startsWith('erector')) return ['lower-back']
  if (t.startsWith('posterior delt') || t.startsWith('infraspinatus') || t.startsWith('teres') || t.startsWith('subscapularis'))
    return ['back-deltoids']
  if (t.includes('delt')) return ['front-deltoids']
  if (t.startsWith('biceps brachii') || t.startsWith('brachialis')) return ['biceps']
  // Der Anconeus streckt mit dem Trizeps zusammen den Ellbogen und taucht
  // im Katalog als dessen Sekundärmuskel auf (Kabelzug Trizepsdrücken).
  // Eine eigene Fläche hat er im Modell nicht.
  if (t.startsWith('triceps') || t.startsWith('anconeus')) return ['triceps']
  if (t.startsWith('brachioradialis') || t.includes('carpi') || t.includes('forearm')) return ['forearm']
  if (t.startsWith('rectus abdominis')) return ['abs']
  if (t.startsWith('obliques') || t.includes('oblique')) return ['obliques']
  // Der mittlere Gesäßmuskel ist der Abduktor — muss vor der allgemeinen
  // Gesäß-Zeile stehen, sonst landet er in der großen Fläche.
  if (t.startsWith('gluteus medius') || t.startsWith('gluteus minimus')) return ['abductors']
  if (t.startsWith('gluteus')) return ['gluteal']
  // "Vastus Mediais" ist ein Tippfehler der Quelle und bleibt so stehen,
  // damit die Zeile trotzdem trifft.
  if (t.startsWith('quadriceps') || t.startsWith('vastus') || t.startsWith('rectus femoris')) return ['quadriceps']
  if (t.startsWith('biceps femoris') || t.includes('semitendinosus') || t.includes('semimembranosus')) return ['hamstring']
  if (t.startsWith('gastrocnemius')) return ['calves']
  if (t.startsWith('soleus')) return ['left-soleus', 'right-soleus']
  if (t.startsWith('adductor')) return ['adductor']
  if (t.startsWith('tensor')) return ['abductors']
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
  /** Je Muskelgruppe, für die Aufstellung darunter. */
  gruppen: {
    name: string
    tage: number
    saetze: number
    /** Der Hauptmuskel aus dem Katalog, sofern die Übungen der Gruppe
        einen tragen — die Druck-Zug-Bilanz ordnet damit genauer zu, als
        es der Gruppenname erlaubt ("Schultern" sagt nicht, ob vorne oder
        hinten). */
    hauptmuskel?: string | null
  }[]
  /** Wie viele Gruppen in den letzten 48 Stunden gereizt wurden. */
  frischeGruppen: number
}

/** Beteiligte Flächen einer Übung samt Anteil.

    Liegt ein Katalogeintrag vor, kommen Haupt-, Sekundär- und
    Tertiärmuskel zum Zug — die stehen für jede Katalogübung fest und
    müssen von niemandem gepflegt werden. Ohne Katalogeintrag bleibt die
    von Hand gesetzte Muskelgruppe als Rückfall: Übungen aus der Zeit vor
    dem neuen Katalog haben keine library_id mehr, und ohne diesen
    Rückfall stünde ihre Belastung nirgends. */
function flaechenAnteile(muskelgruppe: string | null, kat: KatalogMuskeln | undefined): Map<string, number> {
  const anteile = new Map<string, number>()
  const eintragen = (muskel: string | null, anteil: number) => {
    if (!muskel) return
    for (const f of flaechenFuerMuskel(muskel)) {
      anteile.set(f, Math.max(anteile.get(f) ?? 0, anteil))
    }
  }

  if (kat?.primary_muscle) {
    eintragen(kat.primary_muscle, ANTEIL_PRIMAER)
    eintragen(kat.secondary_muscle, ANTEIL_SEKUNDAER)
    eintragen(kat.tertiary_muscle, ANTEIL_TERTIAER)
    if (anteile.size) return anteile
  }

  for (const f of modellFlaechenFuer(muskelgruppe ?? '')) anteile.set(f, ANTEIL_PRIMAER)
  return anteile
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
  /** Katalogeinträge nach exercises.library_id. Fehlt die Angabe, rechnet
      alles wie früher über die von Hand gesetzte Muskelgruppe. */
  katalog?: ReadonlyMap<string, KatalogMuskeln>,
  jetzt: number = Date.now(),
): MuskelHitze {
  /** Was je Übung gilt — Gruppenname für die Aufstellung, Flächenanteile
      fürs Modell. */
  const jeUebung = new Map<string, { gruppe: string; hauptmuskel: string | null; anteile: Map<string, number> }>()
  for (const tag of days) {
    for (const ex of tag.exercises) {
      const kat = ex.library_id ? katalog?.get(ex.library_id) : undefined
      const gruppe = kat?.muscle_group ?? ex.muscle_group
      const anteile = flaechenAnteile(ex.muscle_group, kat)
      // Ohne Gruppenname und ohne Fläche gibt es nichts zu zeigen.
      if (!gruppe && anteile.size === 0) continue
      jeUebung.set(ex.id, { gruppe: gruppe ?? '—', hauptmuskel: kat?.primary_muscle ?? null, anteile })
    }
  }

  const jeGruppe = new Map<string, { saetze: number; zuletzt: number | null; hauptmuskel: string | null }>()
  const jeFlaeche = new Map<string, { saetze: number; zuletzt: number | null }>()

  for (const s of alleSaetze) {
    if (!s.done) continue
    const ueb = jeUebung.get(s.exercise_id)
    if (!ueb) continue
    const zeit = s.done_at ? Date.parse(s.done_at) : NaN
    if (Number.isNaN(zeit)) continue
    const imFenster = jetzt - zeit <= LAST_TAGE * TAG_MS

    const stand = jeGruppe.get(ueb.gruppe) ?? { saetze: 0, zuletzt: null, hauptmuskel: ueb.hauptmuskel }
    if (imFenster) stand.saetze += 1
    if (stand.zuletzt == null || zeit > stand.zuletzt) stand.zuletzt = zeit
    jeGruppe.set(ueb.gruppe, stand)

    for (const [flaeche, anteil] of ueb.anteile) {
      const f = jeFlaeche.get(flaeche) ?? { saetze: 0, zuletzt: null }
      // Der Anteil geht in die Last ein: Beim Bankdrücken zählt die Brust
      // voll, der Trizeps halb, die vordere Schulter ein Viertel.
      if (imFenster) f.saetze += anteil
      // Für die Erholung zählt der Reiz selbst, nicht seine Stärke — ein
      // halber Satz Trizeps liegt genauso lange zurück wie der ganze.
      if (f.zuletzt == null || zeit > f.zuletzt) f.zuletzt = zeit
      jeFlaeche.set(flaeche, f)
    }
  }

  const flaechen = new Map<string, FlaechenHitze>()
  for (const [name, f] of jeFlaeche) {
    if (f.zuletzt == null) continue
    flaechen.set(name, {
      tage: Math.max(0, (jetzt - f.zuletzt) / TAG_MS),
      saetze: Math.round(f.saetze * 10) / 10,
    })
  }

  const gruppen: MuskelHitze['gruppen'] = []
  let frischeGruppen = 0
  for (const [name, stand] of jeGruppe) {
    if (stand.zuletzt == null) continue
    const tage = Math.max(0, (jetzt - stand.zuletzt) / TAG_MS)
    gruppen.push({ name, tage, saetze: stand.saetze, hauptmuskel: stand.hauptmuskel })
    if (tage <= 2) frischeGruppen += 1
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
