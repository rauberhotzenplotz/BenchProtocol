-- Hammer-Strength-Maschinen zurueckholen und ihre Muskeln nachtragen.
--
-- Erzeugt von werkzeuge/hammer-strength.mjs -- dort steht auch die Liste
-- selbst. Nicht von Hand aendern, sondern das Skript anpassen und neu
-- laufen lassen, sonst weichen Datei und Generator voneinander ab.
--
-- Vorgeschichte: Diese 29 Geraete kamen mit Migration 0013 in den
-- Katalog, damals ohne Muskelangaben. Migration 0014 (deutscher Katalog)
-- hat sie dann versehentlich entfernt: Ihr Aufraeumschritt loescht alles,
-- was nicht in der neu erzeugten Liste steht, und die kannte nur die
-- Eintraege aus der Excel-Quelle. Ein Fehler -- die Maschinen waren
-- eigens ergaenzt worden, weil die Quelle gar keine kennt.
--
-- Diese Datei legt fehlende Zeilen an und ergaenzt bei vorhandenen die
-- Muskeln. Sie laeuft damit richtig, egal ob 0014 schon aufgeraeumt hat
-- oder nicht, und darf mehrfach ausgefuehrt werden.

begin;

create temporary table hs_neu (
  name             text not null,
  name_en          text,
  muscle_group     text,
  primary_muscle   text,
  secondary_muscle text,
  tertiary_muscle  text,
  scheme           text,
  rest             text,
  popularity       int
) on commit drop;

insert into hs_neu values
    ('Hammer Strength Bankdrücken', 'Hammer Strength ISO-Lateral Bench Press', 'Brust', 'Pectoralis Major', 'Triceps Brachii', 'Anterior Deltoids', '4 × 8', '2 min', 10204),
    ('Hammer Strength Schrägbankdrücken', 'Hammer Strength ISO-Lateral Incline Press', 'Brust', 'Pectoralis Major', 'Anterior Deltoids', 'Triceps Brachii', '4 × 8', '2 min', 1204),
    ('Hammer Strength Negativbankdrücken', 'Hammer Strength ISO-Lateral Decline Press', 'Brust', 'Pectoralis Major', 'Triceps Brachii', null, '3 × 10', '2 min', 3204),
    ('Hammer Strength Brustpresse weit', 'Hammer Strength Wide Chest Press', 'Brust', 'Pectoralis Major', 'Anterior Deltoids', 'Triceps Brachii', '3 × 10', '2 min', 2205),
    ('Hammer Strength Butterfly', 'Hammer Strength Pec Fly', 'Brust', 'Pectoralis Major', 'Anterior Deltoids', null, '3 × 12', '90 s', 5204),
    ('Hammer Strength Rudern', 'Hammer Strength ISO-Lateral Row', 'Rücken', 'Latissimus Dorsi', 'Posterior Deltoids', 'Biceps Brachii', '4 × 10', '2 min', 1204),
    ('Hammer Strength Rudern hoch', 'Hammer Strength ISO-Lateral High Row', 'Rücken', 'Latissimus Dorsi', 'Posterior Deltoids', 'Biceps Brachii', '4 × 10', '2 min', 1205),
    ('Hammer Strength Rudern tief', 'Hammer Strength ISO-Lateral Low Row', 'Rücken', 'Latissimus Dorsi', 'Rhomboids', 'Biceps Brachii', '4 × 10', '2 min', 1205),
    ('Hammer Strength Latzug', 'Hammer Strength ISO-Lateral Front Lat Pulldown', 'Rücken', 'Latissimus Dorsi', 'Biceps Brachii', 'Rhomboids', '4 × 10', '2 min', 204),
    ('Hammer Strength Latzug eng', 'Hammer Strength ISO-Lateral Narrow Pulldown', 'Rücken', 'Latissimus Dorsi', 'Biceps Brachii', null, '3 × 12', '90 s', 205),
    ('Hammer Strength Kreuzheben', 'Hammer Strength Deadlift', 'Rücken', 'Erector Spinae', 'Gluteus Maximus', 'Biceps Femoris', '4 × 6', '3 min', 3204),
    ('Hammer Strength Shrugs', 'Hammer Strength Shrug', 'Trapez', 'Upper Trapezius', 'Levator Scapulae', null, '4 × 12', '90 s', 3204),
    ('Hammer Strength Schulterdrücken', 'Hammer Strength ISO-Lateral Shoulder Press', 'Schultern', 'Anterior Deltoids', 'Triceps Brachii', 'Upper Trapezius', '4 × 8', '2 min', 204),
    ('Hammer Strength Seitheben', 'Hammer Strength Lateral Raise', 'Schultern', 'Lateral Deltoids', 'Anterior Deltoids', null, '3 × 12', '90 s', 1204),
    ('Hammer Strength Reverse Flys', 'Hammer Strength Rear Delt Fly', 'Schultern', 'Posterior Deltoids', 'Rhomboids', 'Upper Trapezius', '3 × 15', '75 s', 3205),
    ('Hammer Strength Bizepscurls', 'Hammer Strength Biceps Curl', 'Bizeps', 'Biceps Brachii', 'Brachialis', null, '3 × 12', '90 s', 204),
    ('Hammer Strength Preacher Curls', 'Hammer Strength Preacher Curl', 'Bizeps', 'Biceps Brachii', 'Brachialis', 'Brachioradialis', '3 × 12', '90 s', 9205),
    ('Hammer Strength Trizepsdrücken', 'Hammer Strength Triceps Extension', 'Trizeps', 'Triceps Brachii', 'Anconeus', null, '3 × 12', '90 s', 204),
    ('Hammer Strength Dips', 'Hammer Strength Seated Dip', 'Trizeps', 'Triceps Brachii', 'Pectoralis Major', 'Anterior Deltoids', '3 × 10', '2 min', 7204),
    ('Hammer Strength Beinpresse', 'Hammer Strength Leg Press', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', 'Biceps Femoris', '4 × 10', '3 min', 1204),
    ('Hammer Strength Hackenschmidt', 'Hammer Strength Hack Squat', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', null, '4 × 8', '3 min', 6204),
    ('Hammer Strength V-Squat', 'Hammer Strength V Squat', 'Quadrizeps', 'Quadriceps Femoris', 'Gluteus Maximus', 'Biceps Femoris', '4 × 8', '3 min', 10204),
    ('Hammer Strength Beinstrecker', 'Hammer Strength Leg Extension', 'Quadrizeps', 'Quadriceps Femoris', null, null, '3 × 12', '90 s', 2204),
    ('Hammer Strength Beinbeuger sitzend', 'Hammer Strength Seated Leg Curl', 'Beinbeuger', 'Biceps Femoris', 'Gastrocnemius', null, '3 × 12', '90 s', 205),
    ('Hammer Strength Beinbeuger liegend', 'Hammer Strength Lying Leg Curl', 'Beinbeuger', 'Biceps Femoris', 'Gastrocnemius', null, '3 × 12', '90 s', 205),
    ('Hammer Strength Glute Drive', 'Hammer Strength Glute Drive Hip Thrust', 'Gesäß', 'Gluteus Maximus', 'Biceps Femoris', 'Quadriceps Femoris', '4 × 10', '2 min', 6205),
    ('Hammer Strength Wadenheben stehend', 'Hammer Strength Standing Calf Raise', 'Waden', 'Gastrocnemius', 'Soleus', null, '4 × 12', '75 s', 205),
    ('Hammer Strength Wadenheben sitzend', 'Hammer Strength Seated Calf Raise', 'Waden', 'Soleus', 'Gastrocnemius', null, '4 × 15', '75 s', 205),
    ('Hammer Strength Bauchmaschine', 'Hammer Strength Abdominal Crunch', 'Bauchmuskeln', 'Rectus Abdominis', 'Obliques', null, '3 × 15', '75 s', 6204);

-- 1. Vorhandene Zeilen um die Muskeln ergaenzen (falls 0013 noch steht).
update exercise_library el set
  name_en          = h.name_en,
  muscle_group     = h.muscle_group,
  primary_muscle   = h.primary_muscle,
  secondary_muscle = h.secondary_muscle,
  tertiary_muscle  = h.tertiary_muscle,
  equipment        = 'Hammer Strength',
  popularity       = h.popularity
from hs_neu h
where el.name = h.name;

-- 2. Fehlende anlegen, je Nutzer mit Katalog.
insert into exercise_library
  (user_id, name, name_en, muscle_group, primary_muscle, secondary_muscle, tertiary_muscle,
   equipment, difficulty, scheme, rest, sort_order, popularity)
select
  n.user_id, h.name, h.name_en, h.muscle_group, h.primary_muscle, h.secondary_muscle,
  h.tertiary_muscle, 'Hammer Strength', 'Fortgeschritten', h.scheme, h.rest, 0, h.popularity
from (select distinct user_id from exercise_library) as n
cross join hs_neu h
where not exists (
  select 1 from exercise_library e where e.user_id = n.user_id and e.name = h.name
);

commit;
