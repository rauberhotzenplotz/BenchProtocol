/** Drücken oder Ziehen — oder keins von beidem. */
export type Kette = 'druecken' | 'ziehen' | null

/** Muskelgruppen sind Freitext (siehe Migration 0006): Sie kommen aus dem
    Volumen-Kontrollblatt des Nutzers und heißen dort, wie er sie genannt
    hat — "Rücken", aber auch "Schulter seitlich" oder "Lat". Deshalb wird
    über Wortbestandteile erkannt und nicht über eine feste Liste. */
function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}

/** Die hintere Schulter zieht, die vordere und seitliche drücken. Muss vor
    der allgemeinen Schulter-Erkennung greifen, sonst landet das
    Reverse Fly beim Drücken. */
const HINTERE_SCHULTER = /hinte[nr]|rear|revers|posterior|infraspinatus|teres/

const ZIEHT = /ruecken|\blat\b|latissimus|bizeps|trapez|rhombo|klimmzug|rudern|face pull|biceps brachii|brachialis|levator|erector/
const DRUECKT = /brust|trizeps|schulter|delt|pec|triceps/

/** Ordnet eine Muskelgruppe der Drück- oder Zugkette zu.

    Beine, Rumpf und Unterarme bleiben bewusst außen vor: Die Bilanz fragt
    nach dem Verhältnis von Drücken zu Ziehen im Oberkörper, und Kniebeugen
    gehören in keine der beiden Waagschalen. */
export function ketteFuer(muskelgruppe: string): Kette {
  const t = normalisieren(muskelgruppe)
  if (HINTERE_SCHULTER.test(t)) return 'ziehen'
  if (ZIEHT.test(t)) return 'ziehen'
  if (DRUECKT.test(t)) return 'druecken'
  return null
}

export interface GruppenAnteil {
  name: string
  kette: Kette
  saetze: number
}

export interface DruckZug {
  druecken: number
  ziehen: number
  /** Nur die Gruppen, die in eine der beiden Ketten fallen, absteigend. */
  gruppen: GruppenAnteil[]
  /** 0 bis 10, oder null wenn in dieser Woche noch nichts abgehakt ist. */
  punktzahl: number | null
  lage: 'ausgeglichen' | 'zu-wenig-zug' | 'zu-wenig-druck' | null
}

/** Ab hier gilt die Woche als ausgeglichen: Die kleinere Waagschale hält
    mindestens 70 % der größeren. Bewusst nicht 100 % — ein leichter
    Überhang in die eine oder andere Richtung ist normales Training und
    soll keine Warnung auslösen. */
const AUSGEGLICHEN_AB = 7

/** Verhältnis von Drück- zu Zugsätzen.

    Eingabe sind die Sätze je Muskelgruppe aus muskelHitze() — also
    dasselbe rollende Sieben-Tage-Fenster, das auch die Muskel-Heatmap
    zeigt. Vorher zählte diese Karte die Kalenderwoche: Dieselben Gruppen
    standen dann in zwei Karten übereinander mit verschiedenen Zahlen,
    und montags war hier gar nichts zu sehen.

    Die Punktzahl ist bewusst simpel und dadurch erklärbar: der Anteil der
    kleineren Waagschale an der größeren, mal zehn. Gleich viele Sätze in
    beide Richtungen ergeben 10, doppelt so viel Drücken wie Ziehen ergibt
    5. Eine Formel, die man in einem Satz erklären kann, ist hier mehr wert
    als eine genauere, die niemand nachrechnen kann. */
export function druckZugBilanz(
  gruppenSaetze: ReadonlyArray<{ name: string; saetze: number; hauptmuskel?: string | null }>,
): DruckZug {
  const gruppen: GruppenAnteil[] = []
  let druecken = 0
  let ziehen = 0

  for (const { name, saetze, hauptmuskel } of gruppenSaetze) {
    if (saetze === 0) continue
    // Der Hauptmuskel aus dem Katalog geht vor: Seit die Gruppen von dort
    // kommen, heißt alles Schulterhafte schlicht "Schultern" — ob vorne
    // (drückt) oder hinten (zieht), steht nur im Muskelnamen. Ohne
    // Katalogeintrag entscheidet weiter der Gruppenname.
    const kette = (hauptmuskel ? ketteFuer(hauptmuskel) : null) ?? ketteFuer(name)
    if (kette === null) continue
    gruppen.push({ name, kette, saetze })
    if (kette === 'druecken') druecken += saetze
    else ziehen += saetze
  }

  gruppen.sort((a, b) => b.saetze - a.saetze || a.name.localeCompare(b.name))

  if (druecken === 0 && ziehen === 0) {
    return { druecken, ziehen, gruppen, punktzahl: null, lage: null }
  }

  const gross = Math.max(druecken, ziehen)
  const klein = Math.min(druecken, ziehen)
  const punktzahl = Math.round((klein / gross) * 100) / 10

  const lage =
    punktzahl >= AUSGEGLICHEN_AB ? 'ausgeglichen' : druecken > ziehen ? 'zu-wenig-zug' : 'zu-wenig-druck'

  return { druecken, ziehen, gruppen, punktzahl, lage }
}
