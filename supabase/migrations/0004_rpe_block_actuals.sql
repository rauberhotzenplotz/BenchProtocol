-- Bench Protocol — tatsächliche Wochenleistung eines RPE-Blocks
-- Einmal im Supabase SQL Editor ausführen (idempotent, kann gefahrlos
-- erneut laufen).
--
-- Bewusst NICHT über logged_sets erfasst: logged_sets zählt "week" als
-- Plan-Woche und wird an vielen Stellen so gefiltert (Kalender, Cockpit-
-- Tonnage, Gewichts-Vorschlag im Gym-Modus). Ein Block hat aber seine
-- eigene, unabhängige Wochenzählung (Woche 1..plannedWeeks des Blocks) —
-- das in derselben Spalte zu vermischen, würde diese Features verwirren.
-- rpe_block_id an logged_sets (0003) bleibt für eine mögliche spätere
-- Verknüpfung stehen, wird von diesem Modul selbst aber nicht gebraucht.

alter table rpe_planned_sets add column if not exists actual_weight numeric;
alter table rpe_planned_sets add column if not exists actual_reps int;
alter table rpe_planned_sets add column if not exists actual_rpe numeric;
alter table rpe_planned_sets add column if not exists logged_at timestamptz;
