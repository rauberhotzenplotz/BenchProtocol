-- Bench Protocol — automatische RPE-basierte Blockprogression + Einheiten
-- überspringen. Einmal im Supabase SQL Editor ausführen (idempotent, kann
-- gefahrlos erneut laufen).

-- Startwert/Fortschritt der Bank-Progression: bei gesetztem "rpe" nutzt
-- baseE1RM() die RPE-Tabelle statt der Epley-Formel (siehe bench/calc.ts).
-- Bestandspläne ohne "rpe" laufen unverändert über Epley weiter.
alter table plans add column if not exists rpe numeric;

-- Kurze Begründung des letzten automatischen Blockabschlusses, ersetzt die
-- Live-Vorschau, die früher neben dem manuellen "Block abschließen"-Knopf
-- stand.
alter table plans add column if not exists last_delta_note text;

-- Eine übersprungene Einheit ("keine Zeit") zählt nicht als Training, soll
-- aber im Kalender sichtbar bleiben statt so auszusehen, als sei sie nie
-- angefasst worden.
alter table sessions add column if not exists status text not null default 'completed'
  check (status in ('completed', 'skipped'));
