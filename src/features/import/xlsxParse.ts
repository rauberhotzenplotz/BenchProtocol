import readXlsxFile from 'read-excel-file/browser'
import type { Row } from 'read-excel-file/browser'

export interface ParsedExercise {
  name: string
  scheme: string
  rest: string
  note: string
}

export interface ParsedDay {
  name: string
  exercises: ParsedExercise[]
}

export interface ParsedBench {
  work?: number
  reps?: number
  rir?: number
  plate?: number
  /** je 4 Prozentwerte (0–1), eine je Woche — Tag-1-Block bzw. Tag-3-Block. */
  d1Pct: number[]
  d3Pct: number[]
}

export interface ParsedVolumeRow {
  muscleGroup: string
  /** Sätze je Tag, in der Reihenfolge der erkannten Tag-N-Blätter. */
  perDay: number[]
  note: string
}

export interface ParsedWorkbook {
  days: ParsedDay[]
  bench: ParsedBench | null
  volume: ParsedVolumeRow[]
}

function zelle(row: Row | undefined, spalte: number): string {
  const wert = row?.[spalte]
  return wert == null ? '' : String(wert).trim()
}
function zahl(row: Row | undefined, spalte: number): number | undefined {
  const wert = row?.[spalte]
  if (typeof wert === 'number') return wert
  if (typeof wert === 'string' && wert.trim()) {
    const n = parseFloat(wert.replace(',', '.'))
    if (!isNaN(n)) return n
  }
  return undefined
}

/** Liest ein "Tag N"-Blatt: Kopfzeile mit "Übung" in Spalte B, darunter
    je Übung eine Zeile (B=Name, C=Schema, D=Pause, M=Notiz). Zeilen ohne
    Spalte B und C zählen nicht als Übung. */
function leseTagBlatt(rows: Row[]): ParsedExercise[] {
  const headerIdx = rows.findIndex(r => zelle(r, 1).toLowerCase().includes('übung'))
  if (headerIdx === -1) return []
  const exercises: ParsedExercise[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = zelle(rows[i], 1)
    const scheme = zelle(rows[i], 2)
    if (!name && !scheme) continue
    // Manche Vorlagen lassen eine Beispielzeile als Ausfüllhilfe stehen —
    // die zählt nicht als echte Übung.
    if (name.toLowerCase().startsWith('beispiel')) continue
    exercises.push({ name: name || 'Übung', scheme, rest: zelle(rows[i], 3), note: zelle(rows[i], 12) })
  }
  return exercises
}

/** Liest "Bankdrücken Block": vier Label-Zeilen (B=Label, C=Wert), danach
    zwei Blöcke mit Kopfzeile "% vom 1RM" in Spalte D, gefolgt von vier
    Prozentzeilen in Spalte D. */
function leseBankBlock(rows: Row[]): ParsedBench {
  const bench: ParsedBench = { d1Pct: [], d3Pct: [] }
  // Teilstring-Vergleich statt exaktem Vergleich: reale Dateien formulieren
  // die Label oft ausführlicher als die Kurzform aus der Dokumentation,
  // z. B. "Aktuelles Arbeitsgewicht (kg)" statt nur "Arbeitsgewicht".
  const labelWert = (label: string) => {
    const zeile = rows.find(r => zelle(r, 1).toLowerCase().includes(label.toLowerCase()))
    return zeile ? zahl(zeile, 2) : undefined
  }
  bench.work = labelWert('Arbeitsgewicht')
  bench.reps = labelWert('Wiederholungen dabei')
  bench.rir = labelWert('Wiederholungen in Reserve')
  bench.plate = labelWert('Scheibenstufe')

  const kopfZeilen = rows
    .map((r, i) => ({ i, istKopf: zelle(r, 3).toLowerCase().includes('% vom 1rm') }))
    .filter(x => x.istKopf)
    .map(x => x.i)

  const leseProzentBlock = (kopfIdx: number): number[] => {
    const werte: number[] = []
    for (let i = kopfIdx + 1; i < rows.length && werte.length < 4; i++) {
      const roh = zahl(rows[i], 3)
      if (roh == null) break
      werte.push(roh > 1 ? roh / 100 : roh)
    }
    return werte
  }

  if (kopfZeilen[0] != null) bench.d1Pct = leseProzentBlock(kopfZeilen[0])
  if (kopfZeilen[1] != null) bench.d3Pct = leseProzentBlock(kopfZeilen[1])
  return bench
}

/** Liest "Wochenvolumen": Kopfzeile mit "Muskelgruppe" in Spalte B, danach
    je Zeile B=Name, C/D/E=Sätze Tag 1/2/3, G=Notiz. */
function leseVolumen(rows: Row[]): ParsedVolumeRow[] {
  const headerIdx = rows.findIndex(r => zelle(r, 1).toLowerCase().includes('muskelgruppe'))
  if (headerIdx === -1) return []
  const out: ParsedVolumeRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = zelle(rows[i], 1)
    if (!name) continue
    // Echte Muskelgruppen sind kurze Bezeichnungen ("Brust", "Schulter
    // hinten"). Fließtext-Hinweise und eine mögliche Summenzeile am Blatt-
    // ende sind länger bzw. eindeutig als Summe benannt — beides ist keine
    // Muskelgruppe, auch wenn Spalte B gefüllt ist.
    const klein = name.toLowerCase()
    if (name.length > 30 || klein.includes('gesamt') || klein.includes('summe') || klein.includes('muskelgruppe')) continue
    out.push({
      muscleGroup: name,
      perDay: [0, 1, 2].map(o => zahl(rows[i], 2 + o) ?? 0),
      note: zelle(rows[i], 6),
    })
  }
  return out
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const sheets = await readXlsxFile(file)

  const days: ParsedDay[] = []
  let bench: ParsedBench | null = null
  let volume: ParsedVolumeRow[] = []

  for (const { sheet: name, data } of sheets) {
    if (/^tag\s*\d/i.test(name)) {
      const exercises = leseTagBlatt(data)
      if (exercises.length) days.push({ name, exercises })
    } else if (name.toLowerCase() === 'bankdrücken block') {
      bench = leseBankBlock(data)
    } else if (name.toLowerCase() === 'wochenvolumen') {
      volume = leseVolumen(data)
    }
  }

  days.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))

  if (!days.length) {
    throw new Error('Keine „Tag N“-Blätter mit erkennbaren Übungen gefunden.')
  }

  return { days, bench, volume }
}
