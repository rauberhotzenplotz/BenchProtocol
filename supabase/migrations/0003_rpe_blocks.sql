-- Bench Protocol — RPE-basierte Blockprogression (eigenständiges Modul,
-- unabhängig von der bestehenden Bank-Progression). Einmal im Supabase
-- SQL Editor ausführen (idempotent, kann gefahrlos erneut laufen).

-- ════════════════════════════════════════════════════════════════
-- 1 · Tabellen
-- ════════════════════════════════════════════════════════════════

-- Ein Block gehört zu genau einer Übung (nicht an ein Plan-typ gebunden,
-- läuft für jede beliebige Übung). "plate" hier statt am Plan, weil ein
-- Block seine eigene, unabhängig konfigurierbare Hantelinkrementierung
-- hat (siehe zielgewicht() in src/features/rpeblock/e1rm.ts).
create table if not exists rpe_blocks (
  id             uuid primary key default gen_random_uuid(),
  exercise_id    uuid not null references exercises(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_date     date not null default current_date,
  planned_weeks  int  not null default 4 check (planned_weeks >= 1),
  status         text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  plate          numeric not null default 2.5,
  created_at     timestamptz not null default now()
);

-- Geplante Vorgabe je Woche eines Blocks. target_weight ist zunächst leer
-- und wird nachgetragen, sobald ein e1RM zur Rückrechnung vorliegt.
create table if not exists rpe_planned_sets (
  id             uuid primary key default gen_random_uuid(),
  block_id       uuid not null references rpe_blocks(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_number    int not null check (week_number >= 1),
  target_reps    int not null check (target_reps between 1 and 8),
  target_rpe     numeric not null check (target_rpe >= 6 and target_rpe <= 10),
  target_weight  numeric,
  unique (block_id, week_number)
);

-- Verweis eines geloggten Satzes auf den RPE-Block, zu dem er als
-- Wochen-Eintrag gehört (falls einer läuft). Der tatsächliche RPE liegt
-- schon in logged_sets.rpe (0002_done_at.sql) — kein weiteres Feld nötig.
alter table logged_sets add column if not exists rpe_block_id uuid references rpe_blocks(id) on delete set null;

-- ════════════════════════════════════════════════════════════════
-- 2 · Indizes
-- ════════════════════════════════════════════════════════════════

create index if not exists idx_rpe_blocks_exercise       on rpe_blocks(exercise_id);
create index if not exists idx_rpe_planned_sets_block     on rpe_planned_sets(block_id);
create index if not exists idx_logged_sets_rpe_block      on logged_sets(rpe_block_id);

-- ════════════════════════════════════════════════════════════════
-- 3 · Row Level Security — dasselbe Vier-Policy-Muster wie 0001_init.sql
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['rpe_blocks', 'rpe_planned_sets']
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "select own rows" on %I', t);
    execute format(
      'create policy "select own rows" on %I for select using (auth.uid() = user_id)', t
    );

    execute format('drop policy if exists "insert own rows" on %I', t);
    execute format(
      'create policy "insert own rows" on %I for insert with check (auth.uid() = user_id)', t
    );

    execute format('drop policy if exists "update own rows" on %I', t);
    execute format(
      'create policy "update own rows" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t
    );

    execute format('drop policy if exists "delete own rows" on %I', t);
    execute format(
      'create policy "delete own rows" on %I for delete using (auth.uid() = user_id)', t
    );
  end loop;
end $$;
