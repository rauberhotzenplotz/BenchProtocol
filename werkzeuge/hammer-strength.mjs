/* Erzeugt die SQL-Ergänzung für die gängigen Hammer-Strength-Maschinen
   (supabase/migrations/0013_hammer_strength.sql).

   Ausführung:  node werkzeuge/hammer-strength.mjs > supabase/migrations/0013_hammer_strength.sql

   Warum als Generator und nicht von Hand geschrieben: Der Bekanntheitsrang
   (exercise_library.popularity) entscheidet, wie weit oben eine Übung im
   Picker steht, und er muss zur Formel des übrigen Katalogs passen. Die
   liegt in katalog-bekanntheit.mjs — hier wird sie importiert statt
   nachgebaut, damit beide nicht auseinanderlaufen.

   Gerät "Machine": In GERAETE_TIER nicht aufgeführt und fällt damit auf
   Stufe 4. Das ist gewollt — wer "Bankdrücken" sucht, soll weiter die
   Langhantel zuerst sehen, die Maschine danach. */
import { bewerte } from './katalog-bekanntheit.mjs'

/** Die gängigen Geräte der Hammer-Strength-Reihe, wie sie in
    Studios stehen. Deutscher Anzeigename im Stil des übrigen Katalogs
    (Gerät vorn, Bewegung deutsch), englischer Maschinenname zum Suchen —
    danach fragt im Studio ohnehin jeder. */
const UEBUNGEN = [
  // Brust
  ['Hammer Strength Bankdrücken', 'Hammer Strength ISO-Lateral Bench Press', 'Brust', '4 × 8', '2 min'],
  ['Hammer Strength Schrägbankdrücken', 'Hammer Strength ISO-Lateral Incline Press', 'Brust', '4 × 8', '2 min'],
  ['Hammer Strength Negativbankdrücken', 'Hammer Strength ISO-Lateral Decline Press', 'Brust', '3 × 10', '2 min'],
  ['Hammer Strength Brustpresse weit', 'Hammer Strength Wide Chest Press', 'Brust', '3 × 10', '2 min'],
  ['Hammer Strength Butterfly', 'Hammer Strength Pec Fly', 'Brust', '3 × 12', '90 s'],

  // Rücken
  ['Hammer Strength Rudern', 'Hammer Strength ISO-Lateral Row', 'Rücken', '4 × 10', '2 min'],
  ['Hammer Strength Rudern hoch', 'Hammer Strength ISO-Lateral High Row', 'Rücken', '4 × 10', '2 min'],
  ['Hammer Strength Rudern tief', 'Hammer Strength ISO-Lateral Low Row', 'Rücken', '4 × 10', '2 min'],
  ['Hammer Strength Latzug', 'Hammer Strength ISO-Lateral Front Lat Pulldown', 'Rücken', '4 × 10', '2 min'],
  ['Hammer Strength Latzug eng', 'Hammer Strength ISO-Lateral Narrow Pulldown', 'Rücken', '3 × 12', '90 s'],
  ['Hammer Strength Kreuzheben', 'Hammer Strength Deadlift', 'Rücken', '4 × 6', '3 min'],
  ['Hammer Strength Shrugs', 'Hammer Strength Shrug', 'Trapez', '4 × 12', '90 s'],

  // Schultern
  ['Hammer Strength Schulterdrücken', 'Hammer Strength ISO-Lateral Shoulder Press', 'Schultern', '4 × 8', '2 min'],
  ['Hammer Strength Seitheben', 'Hammer Strength Lateral Raise', 'Schultern', '3 × 12', '90 s'],
  ['Hammer Strength Reverse Flys', 'Hammer Strength Rear Delt Fly', 'Schultern', '3 × 15', '75 s'],

  // Arme
  ['Hammer Strength Bizepscurls', 'Hammer Strength Biceps Curl', 'Bizeps', '3 × 12', '90 s'],
  ['Hammer Strength Preacher Curls', 'Hammer Strength Preacher Curl', 'Bizeps', '3 × 12', '90 s'],
  ['Hammer Strength Trizepsdrücken', 'Hammer Strength Triceps Extension', 'Trizeps', '3 × 12', '90 s'],
  ['Hammer Strength Dips', 'Hammer Strength Seated Dip', 'Trizeps', '3 × 10', '2 min'],

  // Beine
  ['Hammer Strength Beinpresse', 'Hammer Strength Leg Press', 'Quadrizeps', '4 × 10', '3 min'],
  ['Hammer Strength Hackenschmidt', 'Hammer Strength Hack Squat', 'Quadrizeps', '4 × 8', '3 min'],
  ['Hammer Strength V-Squat', 'Hammer Strength V Squat', 'Quadrizeps', '4 × 8', '3 min'],
  ['Hammer Strength Beinstrecker', 'Hammer Strength Leg Extension', 'Quadrizeps', '3 × 12', '90 s'],
  ['Hammer Strength Beinbeuger sitzend', 'Hammer Strength Seated Leg Curl', 'Beinbeuger', '3 × 12', '90 s'],
  ['Hammer Strength Beinbeuger liegend', 'Hammer Strength Lying Leg Curl', 'Beinbeuger', '3 × 12', '90 s'],
  ['Hammer Strength Glute Drive', 'Hammer Strength Glute Drive Hip Thrust', 'Gesäß', '4 × 10', '2 min'],
  ['Hammer Strength Wadenheben stehend', 'Hammer Strength Standing Calf Raise', 'Waden', '4 × 12', '75 s'],
  ['Hammer Strength Wadenheben sitzend', 'Hammer Strength Seated Calf Raise', 'Waden', '4 × 15', '75 s'],

  // Rumpf
  ['Hammer Strength Bauchmaschine', 'Hammer Strength Abdominal Crunch', 'Bauchmuskeln', '3 × 15', '75 s'],
]

const sqlText = t => (t == null ? 'null' : `'${String(t).replace(/'/g, "''")}'`)

const zeilen = UEBUNGEN.map(([name, nameEn, gruppe, scheme, rest]) => {
  const rang = bewerte({ name_en: nameEn, muscle_group: gruppe, equipment: 'Machine' })
  return `    (${sqlText(name)}, ${sqlText(nameEn)}, ${sqlText(gruppe)}, ${sqlText(scheme)}, ${sqlText(rest)}, ${rang})`
})

process.stdout.write(`-- Die gängigen Geräte der Hammer-Strength-Reihe als Katalogeinträge.
--
-- Erzeugt von werkzeuge/hammer-strength.mjs -- dort steht auch die Liste
-- selbst. Nicht von Hand ändern, sondern das Skript anpassen und neu
-- laufen lassen, sonst weichen Datei und Generator voneinander ab.
--
-- Der Bekanntheitsrang (popularity) stammt aus derselben Formel wie der
-- übrige Katalog (werkzeuge/katalog-bekanntheit.mjs). Gerätestufe 4 ist
-- gewollt: Wer "Bankdrücken" sucht, soll weiter zuerst die Langhantel
-- sehen und die Maschine danach.
--
-- Läuft für jeden Nutzer, der schon einen Katalog hat -- exercise_library
-- hängt an RLS und gehört je Zeile einem Nutzer. Bereits vorhandene Namen
-- werden übersprungen, die Datei darf also mehrfach ausgeführt werden.

insert into exercise_library
  (user_id, name, name_en, muscle_group, equipment, scheme, rest, sort_order, popularity)
select
  n.user_id, v.name, v.name_en, v.muscle_group, 'Machine', v.scheme, v.rest, 0, v.popularity
from (select distinct user_id from exercise_library) as n
cross join (values
${zeilen.join(',\n')}
) as v(name, name_en, muscle_group, scheme, rest, popularity)
where not exists (
  select 1 from exercise_library e
  where e.user_id = n.user_id and e.name = v.name
);
`)
