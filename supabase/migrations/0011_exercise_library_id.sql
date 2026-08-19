-- Verknüpft eine angelegte Übung optional mit dem Bibliothekseintrag, aus
-- dem sie beim Anlegen gewählt wurde (siehe UebungAuswahl in
-- SessionView.tsx). Reine Herkunftsangabe, keine laufende Synchronisation:
-- Name/Schema bleiben nach dem Anlegen weiterhin unabhängig editierbar,
-- wie es exercise_library schon immer war (siehe 0009).
--
-- Grundlage für planübergreifende Rekorde: RecordsPage kann Sätze aller
-- Übungen mit derselben library_id zusammenfassen, auch wenn dieselbe
-- Katalog-Übung in mehreren Plänen angelegt wurde — statt wie bisher pro
-- Plan eine eigene, leere Bestenliste zu führen.
--
-- on delete set null statt cascade: löscht man den Bibliothekseintrag
-- (oder importiert den Katalog neu), sollen die längst angelegten,
-- unabhängigen Übungen samt ihrer Sätze bestehen bleiben — nur die
-- Herkunftsangabe fällt weg.
alter table exercises
  add column if not exists library_id uuid references exercise_library(id) on delete set null;

create index if not exists idx_exercises_library on exercises(library_id);
