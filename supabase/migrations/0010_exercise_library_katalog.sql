-- Erweitert die Übungsbibliothek von einer schlanken Schema/Pause-Vorlage
-- zu einem vollständigen Übungskatalog (Import aus einer externen
-- Excel-Datenbank, ~3245 Einträge). Alle neuen Spalten sind reine
-- Zusatzinformationen aus dem Import — bewusst nullable, damit von Hand
-- angelegte Vorlagen (nur Name/Schema/Pause) weiterhin gültig bleiben.

alter table exercise_library
  -- Bank-Zuordnung wie exercises.bench_slot: wählt man einen der drei
  -- Bankdrücken-Einträge (schwer/leicht/deload) aus der Bibliothek, wird
  -- die Bank-Zuordnung der neu angelegten Übung automatisch mitgesetzt —
  -- die Gewichte je Woche kommen dann wie gehabt aus bench_progression.
  add column if not exists bench_slot text check (bench_slot in ('d1', 'd3')),

  -- Namensvarianten fürs Suchen — die Bibliothek zeigt/übernimmt nur
  -- "name" (Deutsche Übungsbezeichnung_clean), aber die Suche prüft auch
  -- diese beiden, damit z. B. "Bench Press" ebenfalls "Langhantel
  -- Bankdrücken" findet.
  add column if not exists name_en text,
  add column if not exists name_de_raw text,

  -- Katalogdaten aus dem Import — reine Anzeige-/Filterinformation, von
  -- der App bisher nirgends ausgewertet.
  add column if not exists difficulty text,
  add column if not exists muscle_group text,
  add column if not exists primary_muscle text,
  add column if not exists secondary_muscle text,
  add column if not exists tertiary_muscle text,
  add column if not exists equipment text,
  add column if not exists body_position text,
  add column if not exists hand_pattern text,
  add column if not exists arm_pattern text,
  add column if not exists grip text,
  add column if not exists leg_pattern text,
  add column if not exists body_region text,
  add column if not exists mechanic text,
  add column if not exists laterality text;

-- Der Picker sucht/sortiert über den Namen — bei gut 3245 Zeilen zwar
-- auch ohne Index noch schnell, aber ein einfacher Index kostet nichts
-- und macht die Sortierung sauber.
create index if not exists idx_exercise_library_name on exercise_library(name);
