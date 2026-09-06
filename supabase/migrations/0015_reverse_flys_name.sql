-- Nachtrag zu 0014: drei Übungen für die hintere Schulter hießen wie eine
-- Brustübung.
--
-- Im Wörterbuch von werkzeuge/katalog-deutsch.mjs stand die Brust-Zeile
-- /chest fly|pec fly|\bfly\b|flye/ vor der Zeile für die hintere Schulter.
-- Das \bfly\b traf damit auch "Reverse Fly", und aus
-- "Double Dumbbell Bent Over Reverse Fly" wurde "Kurzhantel Fliegende,
-- vorgebeugt". Die Muskelangaben blieben dabei richtig (Posterior
-- Deltoids, Gruppe Schultern) — falsch war allein der Name, und der ist
-- das, wonach im Studio gesucht wird.
--
-- Der Generator ist korrigiert; wer 0014 noch nicht ausgeführt hat,
-- braucht diese Datei nicht. Für alle anderen benennt sie die drei Zeilen
-- nachträglich um. Betroffen sind genau die Einträge, die "Fliegende"
-- heißen, aber nicht auf die Brust gehen.
--
-- Mehrfach ausführbar: Nach dem ersten Lauf heißt keine Zeile mehr so,
-- die where-Bedingung greift dann ins Leere.

update exercise_library
set name = replace(name, 'Fliegende', 'Reverse Flys')
where name like '%Fliegende%'
  and primary_muscle = 'Posterior Deltoids';
