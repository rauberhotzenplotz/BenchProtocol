-- Bench Protocol — Grundschema + Row Level Security
-- Einmal im Supabase SQL Editor (Project -> SQL Editor -> New query) einfügen
-- und ausführen. Idempotent geschrieben (IF NOT EXISTS / DROP POLICY IF
-- EXISTS), kann also gefahrlos erneut laufen.

create extension if not exists pgcrypto;

-- ════════════════════════════════════════════════════════════════
-- 1 · Tabellen
-- ════════════════════════════════════════════════════════════════

-- Ein Trainingsplan. work/reps/rir/plate/block/goal/goal_from/beruehrt
-- sind nur bei typ='bench' sinnvoll befüllt (Bankdrücken-Progression) —
-- bewusst am Plan statt global, weil ein Nutzer mehrere Bankfokus-Pläne
-- parallel führen können soll, jeder mit eigenem Ausgangsgewicht.
create table if not exists plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  typ         text not null check (typ in ('bench', 'general')),
  week        int  not null default 1 check (week >= 1),
  work        numeric,
  reps        int,
  rir         int,
  plate       numeric default 2.5,
  block       int default 1,
  goal        numeric,
  goal_from   numeric,
  beruehrt    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trainingstage innerhalb eines Plans ("Tag 1", "Tag 2", ...).
create table if not exists plan_days (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  sub         text,
  sort_order  int not null default 0
);

-- Übungen innerhalb eines Tages. bench_slot markiert die zwei Übungen,
-- die an die Bank-Progression eines Plans gekoppelt sind (schwer/Pause).
create table if not exists exercises (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null references plan_days(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  scheme      text,
  rest        text,
  note        text,
  bench_slot  text check (bench_slot in ('d1', 'd3')),
  sort_order  int not null default 0
);

-- 4-Wochen-Prozenttabelle der Bank-Progression, je Plan und Slot.
create table if not exists bench_progression (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot        text not null check (slot in ('d1', 'd3')),
  week        int  not null check (week between 1 and 4),
  scheme      text,
  pct         numeric,
  hint        text,
  unique (plan_id, slot, week)
);

-- Wochenvolumen-Kontrollblatt. sets_by_day statt fixer Tagesspalten, damit
-- ein Plan mit abweichender Tagesanzahl nicht künstlich begrenzt wird.
create table if not exists volume_rows (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  muscle_group  text not null check (char_length(trim(muscle_group)) > 0),
  sets_by_day   jsonb not null default '{}'::jsonb,
  note          text,
  sort_order    int not null default 0
);

-- Einzelne geloggte Sätze je Übung und Woche. unique(...) macht aus dem
-- Eintragen eines Satzes ein klares upsert (on_conflict) statt Duplikate
-- pro Position zuzulassen.
create table if not exists logged_sets (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references exercises(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week         int  not null check (week >= 1),
  "position"   int  not null check ("position" >= 0),
  kg           numeric,
  reps         int,
  rpe          numeric,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (exercise_id, week, "position")
);

-- Start/Ende einer Trainingseinheit — ein Tag kann in einer Woche höchstens
-- einmal laufen (erneutes Starten überschreibt dieselbe Zeile).
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null references plan_days(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week        int  not null check (week >= 1),
  started_at  timestamptz not null,
  ended_at    timestamptz,
  minutes     int,
  unique (day_id, week)
);

-- ════════════════════════════════════════════════════════════════
-- 2 · Indizes für die üblichen Abfragen (je Plan/Tag/Übung + Woche)
-- ════════════════════════════════════════════════════════════════

create index if not exists idx_plans_user             on plans(user_id);
create index if not exists idx_plan_days_plan          on plan_days(plan_id);
create index if not exists idx_exercises_day           on exercises(day_id);
create index if not exists idx_bench_progression_plan  on bench_progression(plan_id);
create index if not exists idx_volume_rows_plan        on volume_rows(plan_id);
-- logged_sets(exercise_id, week, position) ist bereits durch den unique-
-- Constraint oben indiziert, ein eigener Index wäre redundant.
create index if not exists idx_sessions_day_week       on sessions(day_id, week);

-- updated_at auf plans automatisch nachziehen.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists plans_set_updated_at on plans;
create trigger plans_set_updated_at before update on plans
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 3 · Row Level Security
--
-- Jede Tabelle trägt user_id direkt (statt RLS über einen Join durch
-- plans laufen zu lassen) — einfachere, schnellere Policies. Jede Tabelle
-- bekommt dasselbe Vier-Policy-Muster: select/insert/update/delete, immer
-- auth.uid() = user_id. "with check" verhindert zusätzlich, dass beim
-- Einfügen/Ändern eine fremde user_id untergeschoben wird — der Spalten-
-- Default auth.uid() deckt den Normalfall ohnehin ab.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'plans', 'plan_days', 'exercises', 'bench_progression',
    'volume_rows', 'logged_sets', 'sessions'
  ]
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
