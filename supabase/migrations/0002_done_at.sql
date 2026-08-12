-- Bench Protocol — Zeitstempel für "wann wurde ein Satz erledigt"
-- Einmal im Supabase SQL Editor ausführen (idempotent, kann gefahrlos
-- erneut laufen).

-- Grundlage für die Übungsdauer-Anzeige: Dauer je Übung = Zeit vom letzten
-- erledigten Satz der vorigen Übung (bzw. Trainingsstart bei der ersten)
-- bis zum letzten erledigten Satz dieser Übung.
alter table logged_sets add column if not exists done_at timestamptz;
