import type { LoggedSet } from '../../types/db'
import { formatGewicht } from '../../lib/zahlen'

/** Wiederholungsbereich aus einem Schema: "3 × 8–12" ergibt 8 bis 12,
    "4 × 8" einen festen Wert (8 bis 8). Akzeptiert Gedankenstrich,
    Bindestrich und "bis". Ohne erkennbare Zahl hinter dem "×" null —
    dann gibt es keinen Maßstab, wann gesteigert werden soll. */
export interface WdhBereich {
  min: number
  max: number
}

export function wdhBereich(scheme: string | null | undefined): WdhBereich | null {
  const m = String(scheme ?? '').match(/[×x*]\s*(\d+)(?:\s*(?:[–—-]|bis)\s*(\d+))?/i)
  if (!m) return null
  const a = +m[1]
  const b = m[2] != null ? +m[2] : a
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

export type ProgressionsArt = 'gewicht' | 'wdh' | 'halten'

export interface SatzVorschlag {
  kg: number
  reps: number
  art: ProgressionsArt
}

export interface Progression {
  /** Die stärkste Änderung über alle Sätze: ein Satz mit mehr Gewicht
      macht die ganze Übung zu "gewicht", sonst zählt "wdh". */
  art: ProgressionsArt
  /** Je Satzposition der letzten Einheit, in derselben Reihenfolge. */
  saetze: SatzVorschlag[]
  grund: string
}

/** Ab diesem RPE gilt ein Satz als ausgereizt — auch wer damit das obere
    Ende des Bereichs geschafft hat, steigert noch nicht, sondern
    wiederholt das Gewicht erst einmal sauber. */
const RPE_GRENZE = 9.5

/** Doppelte Progression je Satz, wie man sie aus Alpha Progression kennt:
    Erst werden die Wiederholungen im Bereich des Schemas nach oben
    geschoben, und erst wer das obere Ende erreicht, bekommt beim nächsten
    Mal eine Scheibenstufe mehr — und fängt dann wieder unten im Bereich an.

    Bewusst je Satz und nicht je Übung: In den echten Daten fallen die
    Gewichte innerhalb einer Übung oft ab (85 / 82,5 / 80 kg). Ein Vorschlag
    für die ganze Übung müsste diese Staffel einebnen; je Satz bleibt sie
    erhalten, und jeder Satz steigt, sobald er selbst so weit ist.

    Ein verpasster Satz (unter dem Bereich) bleibt beim Gewicht und soll
    eine Wiederholung mehr schaffen, statt sofort abgestuft zu werden — ein
    schlechter Tag ist noch kein Trend.

    null, wenn es nichts gibt, worauf sich ein Vorschlag stützen kann: keine
    letzte Einheit mit Gewicht und Wiederholungen, oder ein Schema ohne
    Wiederholungsangabe. Der Aufrufer fällt dann auf die bisherige
    Vorbelegung (letzte Einheit unverändert) zurück. */
export function progressionsVorschlag(
  letzteEinheit: LoggedSet[],
  scheme: string | null | undefined,
  stufe: number,
  optionen: { deload?: boolean } = {},
): Progression | null {
  const bereich = wdhBereich(scheme)
  if (!bereich) return null

  const mitWerten = letzteEinheit.filter(s => (s.kg ?? 0) > 0 && (s.reps ?? 0) > 0)
  // Abgehakte Sätze zählen, wenn es welche gibt — ein nur vorbelegter,
  // nie gemachter Satz sagt nichts darüber, was geschafft wurde.
  const erledigt = mitWerten.filter(s => s.done)
  const basis = (erledigt.length ? erledigt : mitWerten).sort((a, b) => a.position - b.position)
  if (!basis.length) return null

  if (optionen.deload) {
    return {
      art: 'halten',
      saetze: basis.map(s => ({ kg: s.kg as number, reps: s.reps as number, art: 'halten' })),
      grund: 'Deload-Woche — keine Steigerung, Gewichte wie zuletzt',
    }
  }

  let ausgereizt = false
  const saetze = basis.map((s): SatzVorschlag => {
    const kg = s.kg as number
    const reps = s.reps as number
    if (reps >= bereich.max) {
      if (s.rpe != null && s.rpe >= RPE_GRENZE) {
        ausgereizt = true
        return { kg, reps: bereich.max, art: 'halten' }
      }
      return { kg: kg + stufe, reps: bereich.min, art: 'gewicht' }
    }
    return { kg, reps: Math.min(bereich.max, reps + 1), art: 'wdh' }
  })

  const art: ProgressionsArt = saetze.some(s => s.art === 'gewicht')
    ? 'gewicht'
    : saetze.some(s => s.art === 'wdh')
      ? 'wdh'
      : 'halten'
  const ziel = bereich.min === bereich.max ? `${bereich.max} Wdh.` : `${bereich.min}–${bereich.max} Wdh.`
  const grund =
    art === 'gewicht'
      ? `+${formatGewicht(stufe)} kg — letztes Mal das Ziel von ${ziel} geschafft`
      : art === 'wdh'
        ? `Gleiches Gewicht, eine Wiederholung mehr — Ziel ${ziel}`
        : ausgereizt
          ? `Letztes Mal RPE ${formatGewicht(RPE_GRENZE)}+ — Gewicht erst sauber wiederholen`
          : `Gewichte wie zuletzt`

  return { art, saetze, grund }
}

/** Vorschlag für eine Satzposition. Hat die heutige Einheit mehr Zeilen
    als die letzte, gilt für die zusätzlichen der letzte Satz weiter —
    dieselbe Regel wie bei der bisherigen Vorbelegung in GymModeAP. */
export function vorschlagFuer(progression: Progression | null, position: number): SatzVorschlag | null {
  if (!progression || !progression.saetze.length) return null
  return progression.saetze[position] ?? progression.saetze[progression.saetze.length - 1]
}
