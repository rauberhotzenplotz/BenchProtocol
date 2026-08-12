/** Export-Format gängiger Trainings-Tracker-Apps (z. B. AlphaProgression):
    Semikolon-getrennt, eine Einheit nach der anderen.

    "Titel";"Datum Uhrzeit";"Dauer"
    #;KG;WDH                              (optional, wird übersprungen)
    "Name · Gerät · Wdh-Ziel"
    Nr;Gewicht;Wiederholungen

    Gewicht mit Komma als Dezimaltrennzeichen, "+" für Zusatzgewicht,
    "-" statt Gewicht/Wiederholungen heißt "Satz nicht ausgeführt". */

export interface CsvSet {
  kg: number
  reps: number
}

export interface CsvExercise {
  name: string
  gear: string
  target: string
  sets: CsvSet[]
}

export interface CsvWorkout {
  title: string
  date: string
  week: number | null
  day: number | null
  exercises: CsvExercise[]
}

const kgNum = (v: string): number => {
  const n = parseFloat(v.replace('+', '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function parseAlphaCsv(text: string): CsvWorkout[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const outs: CsvWorkout[] = []
  let w: CsvWorkout | null = null
  let ex: CsvExercise | null = null

  for (const raw of lines) {
    const s = raw.trim()
    if (!s) continue

    if (s[0] === '"' && s.includes('";"')) {
      const p = s.split('";"').map(x => x.replace(/^"|"$/g, '').trim())
      w = {
        title: p[0] ?? '',
        date: p[1] ?? '',
        day: +((p[0]?.match(/Tag\s*(\d+)/) ?? [])[1]) || null,
        week: +((p[0]?.match(/Woche\s*(\d+)/) ?? [])[1]) || null,
        exercises: [],
      }
      outs.push(w)
      ex = null
    } else if (/^#\s*;/.test(s)) {
      continue
    } else if (s[0] === '"') {
      const body = s.replace(/^"|"$/g, '').replace(/^\d+\.\s*/, '')
      const t = body.split('·').map(x => x.trim())
      ex = { name: t[0] || body, gear: t[1] || '', target: t[2] || '', sets: [] }
      if (w) w.exercises.push(ex)
    } else if (ex && /^\d+\s*;/.test(s)) {
      const f = s.split(';').map(x => x.trim())
      if (f[1] === '-' || f[2] === '-' || !f[2]) continue
      const reps = parseInt(f[2], 10)
      if (!reps) continue
      ex.sets.push({ kg: kgNum(f[1] ?? ''), reps })
    }
  }

  outs.forEach(o => {
    o.exercises = o.exercises.filter(e => e.sets.length > 0)
  })
  return outs.filter(o => o.exercises.length > 0)
}
