import { geschaetztes1RM } from './e1rm'

export interface GeloggterSatz {
  gewicht: number
  wdh: number
  rpe: number | null
}

/** Wählt den repräsentativen Satz einer Woche: den mit dem höchsten e1RM
    unter allen Sätzen mit sauber geloggtem RPE. Sätze ohne RPE oder
    außerhalb der RPE-Tabelle (siehe geschaetztes1RM) zählen nicht mit.
    null, wenn keiner der Sätze auswertbar ist. */
export function topSatzDerWoche(saetze: GeloggterSatz[]): { gewicht: number; wdh: number; rpe: number } | null {
  let bester: { gewicht: number; wdh: number; rpe: number } | null = null
  let besterE1rm = -Infinity

  saetze.forEach(s => {
    if (s.rpe == null) return
    const e1 = geschaetztes1RM(s.gewicht, s.wdh, s.rpe)
    if (e1 == null || e1 <= besterE1rm) return
    besterE1rm = e1
    bester = { gewicht: s.gewicht, wdh: s.wdh, rpe: s.rpe }
  })

  return bester
}

export interface WochenEintrag {
  woche: number
  /** Vom Aufrufer per topSatzDerWoche() ermittelt — null, wenn diese Woche
      keinen auswertbaren Satz hat (nichts geloggt oder RPE fehlt/ungültig). */
  topSatz: { gewicht: number; wdh: number; rpe: number } | null
  /** Für diese Woche geplanter RPE, für die Drift-Berechnung. null, wenn
      für die Woche kein Ziel-RPE hinterlegt ist. */
  geplanterRpe: number | null
}

export interface BlockAuswertung {
  blockStartE1RM: number | null
  blockBestE1RM: number | null
  /** Prozentuale Veränderung von Start- zu Best-e1RM, oder null, wenn sich
      keins der beiden berechnen lässt (z. B. Woche 1 ohne gültigen Satz). */
  deltaPercent: number | null
  /** Ø (tatsächlicher RPE − geplanter RPE) über alle Wochen mit geplantem
      RPE und auswertbarem Topsatz. null ohne eine einzige solche Woche. */
  rpeDrift: number | null
  /** Anzahl Wochen mit auswertbarem e1RM — Grundlage für INSUFFICIENT_DATA. */
  gueltigeWochen: number
}

/** Fasst einen abgeschlossenen (oder laufenden) Block zusammen. Reine
    Funktion — keine Datenbankzugriffe, keine Seiteneffekte. */
export function blockAuswertung(wochen: WochenEintrag[]): BlockAuswertung {
  const proWoche = wochen.map(w => ({
    woche: w.woche,
    e1rm: w.topSatz ? geschaetztes1RM(w.topSatz.gewicht, w.topSatz.wdh, w.topSatz.rpe) : null,
    tatsaechlicherRpe: w.topSatz?.rpe ?? null,
    geplanterRpe: w.geplanterRpe,
  }))

  const gueltige = proWoche.filter((w): w is typeof w & { e1rm: number } => w.e1rm != null)
  const gueltigeWochen = gueltige.length

  const blockStartE1RM = proWoche.find(w => w.woche === 1)?.e1rm ?? null
  const blockBestE1RM = gueltigeWochen > 0 ? Math.max(...gueltige.map(w => w.e1rm)) : null

  const deltaPercent =
    blockStartE1RM != null && blockBestE1RM != null && blockStartE1RM > 0
      ? ((blockBestE1RM - blockStartE1RM) / blockStartE1RM) * 100
      : null

  const driftWerte = proWoche
    .filter((w): w is typeof w & { geplanterRpe: number; tatsaechlicherRpe: number } => w.geplanterRpe != null && w.tatsaechlicherRpe != null)
    .map(w => w.tatsaechlicherRpe - w.geplanterRpe)
  const rpeDrift = driftWerte.length > 0 ? driftWerte.reduce((a, b) => a + b, 0) / driftWerte.length : null

  return { blockStartE1RM, blockBestE1RM, deltaPercent, rpeDrift, gueltigeWochen }
}

export type BlockEmpfehlungTyp = 'PROGRESS' | 'ADD_STIMULUS' | 'REDUCE_FATIGUE' | 'INSUFFICIENT_DATA'

export interface Empfehlung {
  typ: BlockEmpfehlungTyp
  begruendung: string
}

const MINDEST_WOCHEN = 3
const DELTA_SCHWELLE = 2.0
const DRIFT_SCHWELLE = 0.5

/** Empfehlung für den nächsten Block aus einer Block-Auswertung. Reine
    Funktion, keine Seiteneffekte — die Reihenfolge der Prüfungen ist
    bewusst: zu wenig Daten sticht alles, danach schlägt eine erhöhte
    Ermüdung (RPE-Drift) unabhängig vom erzielten Fortschritt durch. */
export function empfehlung(auswertung: BlockAuswertung): Empfehlung {
  const { blockStartE1RM, blockBestE1RM, deltaPercent, rpeDrift, gueltigeWochen } = auswertung

  if (gueltigeWochen < MINDEST_WOCHEN || deltaPercent == null || rpeDrift == null || blockStartE1RM == null || blockBestE1RM == null) {
    return {
      typ: 'INSUFFICIENT_DATA',
      begruendung: `Nur ${gueltigeWochen} von mindestens ${MINDEST_WOCHEN} nötigen Wochen mit auswertbarem e1RM — noch keine verlässliche Empfehlung möglich.`,
    }
  }

  if (rpeDrift > DRIFT_SCHWELLE) {
    return {
      typ: 'REDUCE_FATIGUE',
      begruendung: `Der RPE lag im Schnitt ${rpeDrift.toFixed(1)} über der Vorgabe — mehr Ermüdung als geplant. Volumen reduzieren, ggf. einen Deload voranstellen.`,
    }
  }

  if (deltaPercent >= DELTA_SCHWELLE) {
    return {
      typ: 'PROGRESS',
      begruendung: `1RM stieg um ${deltaPercent.toFixed(1)} % (${blockStartE1RM.toFixed(1)} → ${blockBestE1RM.toFixed(1)} kg) bei planmäßigem RPE (Drift ${rpeDrift.toFixed(1)}). Struktur beibehalten, Lasten auf Basis von ${blockBestE1RM.toFixed(1)} kg neu berechnen.`,
    }
  }

  return {
    typ: 'ADD_STIMULUS',
    begruendung: `1RM stieg nur um ${deltaPercent.toFixed(1)} % (${blockStartE1RM.toFixed(1)} → ${blockBestE1RM.toFixed(1)} kg) bei unauffälligem RPE (Drift ${rpeDrift.toFixed(1)}). Reiz war zu gering — Volumen oder Frequenz erhöhen.`,
  }
}
