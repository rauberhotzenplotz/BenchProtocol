-- Die gängigen Geräte der Hammer-Strength-Reihe als Katalogeinträge.
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
    ('Hammer Strength Bankdrücken', 'Hammer Strength ISO-Lateral Bench Press', 'Brust', '4 × 8', '2 min', 406),
    ('Hammer Strength Schrägbankdrücken', 'Hammer Strength ISO-Lateral Incline Press', 'Brust', '4 × 8', '2 min', 6406),
    ('Hammer Strength Negativbankdrücken', 'Hammer Strength ISO-Lateral Decline Press', 'Brust', '3 × 10', '2 min', 6406),
    ('Hammer Strength Brustpresse weit', 'Hammer Strength Wide Chest Press', 'Brust', '3 × 10', '2 min', 6406),
    ('Hammer Strength Butterfly', 'Hammer Strength Pec Fly', 'Brust', '3 × 12', '90 s', 4405),
    ('Hammer Strength Rudern', 'Hammer Strength ISO-Lateral Row', 'Rücken', '4 × 10', '2 min', 1405),
    ('Hammer Strength Rudern hoch', 'Hammer Strength ISO-Lateral High Row', 'Rücken', '4 × 10', '2 min', 1406),
    ('Hammer Strength Rudern tief', 'Hammer Strength ISO-Lateral Low Row', 'Rücken', '4 × 10', '2 min', 1406),
    ('Hammer Strength Latzug', 'Hammer Strength ISO-Lateral Front Lat Pulldown', 'Rücken', '4 × 10', '2 min', 407),
    ('Hammer Strength Latzug eng', 'Hammer Strength ISO-Lateral Narrow Pulldown', 'Rücken', '3 × 12', '90 s', 10406),
    ('Hammer Strength Kreuzheben', 'Hammer Strength Deadlift', 'Rücken', '4 × 6', '3 min', 3404),
    ('Hammer Strength Shrugs', 'Hammer Strength Shrug', 'Trapez', '4 × 12', '90 s', 404),
    ('Hammer Strength Schulterdrücken', 'Hammer Strength ISO-Lateral Shoulder Press', 'Schultern', '4 × 8', '2 min', 406),
    ('Hammer Strength Seitheben', 'Hammer Strength Lateral Raise', 'Schultern', '3 × 12', '90 s', 2405),
    ('Hammer Strength Reverse Flys', 'Hammer Strength Rear Delt Fly', 'Schultern', '3 × 15', '75 s', 6406),
    ('Hammer Strength Bizepscurls', 'Hammer Strength Biceps Curl', 'Bizeps', '3 × 12', '90 s', 405),
    ('Hammer Strength Preacher Curls', 'Hammer Strength Preacher Curl', 'Bizeps', '3 × 12', '90 s', 2405),
    ('Hammer Strength Trizepsdrücken', 'Hammer Strength Triceps Extension', 'Trizeps', '3 × 12', '90 s', 7405),
    ('Hammer Strength Dips', 'Hammer Strength Seated Dip', 'Trizeps', '3 × 10', '2 min', 4405),
    ('Hammer Strength Beinpresse', 'Hammer Strength Leg Press', 'Quadrizeps', '4 × 10', '3 min', 1405),
    ('Hammer Strength Hackenschmidt', 'Hammer Strength Hack Squat', 'Quadrizeps', '4 × 8', '3 min', 405),
    ('Hammer Strength V-Squat', 'Hammer Strength V Squat', 'Quadrizeps', '4 × 8', '3 min', 405),
    ('Hammer Strength Beinstrecker', 'Hammer Strength Leg Extension', 'Quadrizeps', '3 × 12', '90 s', 3405),
    ('Hammer Strength Beinbeuger sitzend', 'Hammer Strength Seated Leg Curl', 'Beinbeuger', '3 × 12', '90 s', 406),
    ('Hammer Strength Beinbeuger liegend', 'Hammer Strength Lying Leg Curl', 'Beinbeuger', '3 × 12', '90 s', 406),
    ('Hammer Strength Glute Drive', 'Hammer Strength Glute Drive Hip Thrust', 'Gesäß', '4 × 10', '2 min', 407),
    ('Hammer Strength Wadenheben stehend', 'Hammer Strength Standing Calf Raise', 'Waden', '4 × 12', '75 s', 406),
    ('Hammer Strength Wadenheben sitzend', 'Hammer Strength Seated Calf Raise', 'Waden', '4 × 15', '75 s', 406),
    ('Hammer Strength Bauchmaschine', 'Hammer Strength Abdominal Crunch', 'Bauchmuskeln', '3 × 15', '75 s', 405)
) as v(name, name_en, muscle_group, scheme, rest, popularity)
where not exists (
  select 1 from exercise_library e
  where e.user_id = n.user_id and e.name = v.name
);
