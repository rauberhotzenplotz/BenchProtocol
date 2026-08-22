/* Bekanntheitsrang (exercise_library.popularity) für den Übungskatalog neu
   berechnen. Kleiner Wert = weiter oben im Picker; 0 bleibt von Hand
   angelegten Vorlagen vorbehalten (Spalten-Default, siehe Migration 0012).

   Ausführung: Der Katalog hängt an RLS, das Skript braucht also eine
   angemeldete Sitzung. Es läuft deshalb im WebView der App auf dem
   Testgerät (Chrome-DevTools-Protokoll), nicht als eigenständiges
   Node-Skript. Der Inhalt von bewerte() wird dort als Ausdruck
   ausgeführt; diese Datei ist die lesbare, versionierte Fassung.

   Warum die Formel so aussieht: Der erste Versuch war
   1 + bewegung*100 + geraet*10 mit Barbell und Dumbbell im selben Tier.
   Dadurch bekamen "Barbell Bench Press" und "Alternating Double Dumbbell
   Bench Press" denselben Wert, und die alphabetische Zweitsortierung
   stellte die Alternating-Variante nach vorn — wer "Bankdrücken" suchte,
   fand das Langhantel-Bankdrücken erst weit unten.

   Drei Stufen, jede deutlich schwächer als die vorige:
   1. Bewegung   (*1000) — welche Übung überhaupt: Bankdrücken vor Fly.
   2. Gerät      (*100)  — Langhantel vor Kurzhantel vor Exotik.
   3. Wortzahl   (*1)    — die kanonische Variante hat den kürzesten
                           Namen. "Barbell Bench Press" (3 Wörter) schlägt
                           "Barbell Top Down Decline Bench Press" (6).
   Erst wenn alle drei gleich sind, entscheidet der Name (ORDER BY name
   in der Abfrage). */

/** Bekannteste Bewegungen je Muskelgruppe, absteigend. Geprüft gegen
    name_en, erster Treffer gewinnt. */
export const ANKER = {
  'Rücken': [/lat pulldown/i, /\brow\b/i, /pull.?up/i, /deadlift/i, /good morning/i, /rack pull/i, /face pull/i, /pullover/i, /hyperextension/i, /shrug/i],
  'Brust': [/bench press/i, /push up/i, /floor press/i, /\bdip\b/i, /\bfly\b|flye/i, /pullover/i],
  'Schultern': [/overhead press|shoulder press|military press/i, /push press/i, /lateral raise/i, /front raise/i, /face pull/i, /upright row/i, /rear delt|reverse fly/i, /z press/i, /cuban/i, /external rotation/i, /handstand/i],
  'Bizeps': [/bicep(s)? curl/i, /chin.?up/i, /preacher curl/i, /concentration curl/i, /hammer curl/i, /spider curl/i],
  'Trizeps': [/tricep(s)? push ?down/i, /skull crusher/i, /close grip bench press/i, /overhead tricep/i, /\bdip\b/i, /tricep extension/i, /kickback/i],
  'Unterarme': [/wrist curl/i, /farmer.?s? (walk|carry)/i, /reverse.*curl/i, /dead hang|grip/i],
  'Bauchmuskeln': [/crunch/i, /plank/i, /sit.?up/i, /leg raise/i, /russian twist/i, /mountain climber/i, /ab wheel|rollout/i, /\bv.?up\b/i, /dead bug/i, /bird dog/i, /woodchop/i],
  'Hüftbeuger': [/leg raise/i, /knee raise/i, /march/i, /mountain climber/i, /flutter kick/i],
  'Gesäß': [/hip thrust/i, /glute bridge/i, /deadlift/i, /squat/i, /kickback/i, /donkey kick/i, /hip abduction/i, /frog pump/i],
  'Quadrizeps': [/\bsquat\b/i, /leg press/i, /lunge/i, /leg extension/i, /step.?up/i, /thruster/i, /wall sit/i],
  'Beinbeuger': [/leg curl|hamstring curl/i, /romanian deadlift|\brdl\b/i, /good morning/i, /stiff.?leg(ged)? deadlift/i, /glute ham raise/i, /nordic/i],
  'Adduktoren': [/adduct/i, /sumo/i, /cossack/i, /copenhagen/i],
  'Abduktoren': [/abduct/i, /clamshell/i, /lateral.*walk|monster walk/i, /fire hydrant/i, /skater/i],
  'Waden': [/calf raise/i],
  'Schienbeine': [/tibialis raise/i],
  'Trapez': [/shrug/i, /farmer.?s? (walk|carry)/i, /upright row/i],
}

/** 0 = Grundausstattung jedes Studios und für die meisten Grundübungen
    das kanonische Gerät, 5 = Spezialgerät. Langhantel steht bewusst
    allein auf 0: Wer "Bankdrücken", "Kniebeuge" oder "Rudern" sucht,
    meint zuerst die Langhantelvariante. */
export const GERAETE_TIER = {
  Barbell: 0,
  Dumbbell: 1, Cable: 1, Bodyweight: 1, 'Pull Up Bar': 1,
  'EZ Bar': 2, 'Trap Bar': 2, Landmine: 2,
  Kettlebell: 3, 'Resistance Band': 3, Miniband: 3, Superband: 3,
  'Suspension Trainer': 4, 'Gymnastic Rings': 4, 'Stability Ball': 4,
  'Parallette Bars': 4, 'Weight Plate': 4, 'Ab Wheel': 4, Sliders: 4,
  Macebell: 5, Clubbell: 5, 'Indian Club': 5, 'Bulgarian Bag': 5,
  'Heavy Sandbag': 5, Sandbag: 5, 'Battle Ropes': 5, Tire: 5, Sled: 5,
  'Slam Ball': 5, 'Wall Ball': 5, 'Medicine Ball': 5, 'Climbing Rope': 5,
}

export function bewerte(zeile) {
  const name = zeile.name_en || zeile.name || ''
  const anker = ANKER[zeile.muscle_group] ?? []
  let bewegung = anker.findIndex(muster => muster.test(name))
  if (bewegung === -1) bewegung = anker.length
  const geraet = GERAETE_TIER[zeile.equipment] ?? 4
  // Gedeckelt, damit ein ungewöhnlich langer Name nie in die Gerätestufe
  // hineinreicht (100 wäre die nächste Stufe).
  const woerter = Math.min(name.trim().split(/\s+/).filter(Boolean).length, 40)
  return 1 + bewegung * 1000 + geraet * 100 + woerter
}
