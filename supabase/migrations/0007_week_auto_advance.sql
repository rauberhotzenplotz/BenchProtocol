-- Grundlage für den automatischen Wochenwechsel (ersetzt die manuellen
-- W1–W4/Deload-Knöpfe im Training-Tab): hält fest, seit wann die aktuell
-- eingetragene Woche läuft, damit die App nach 7 Tagen selbst weiterschaltet.
alter table plans add column if not exists week_started_at timestamptz not null default now();
