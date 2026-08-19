-- Bench Protocol — Übungsbibliothek: je Übungsname eine Vorlage mit
-- empfohlenem Schema und Pausenzeit. Beim Anlegen einer Übung in einem
-- Plan werden scheme/rest daraus nur kopiert (siehe NeueUebungForm in
-- SessionView.tsx) — die Übung bleibt danach unabhängig editierbar, eine
-- spätere Änderung an der Bibliothek wirkt sich nicht rückwirkend aus.
-- Bewusst keine Fremdschlüsselbeziehung zu exercises: dieselbe Freiheit,
-- wie sie exercises.name/scheme/rest ohnehin schon haben (Freitext, ohne
-- Eindeutigkeitszwang — genau wie plans.name oder plan_days.name).

create table if not exists exercise_library (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  scheme      text,
  rest        text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_exercise_library_user on exercise_library(user_id);

-- Row Level Security — dasselbe Vier-Policy-Muster wie 0001_init.sql.
do $$
declare
  t text;
begin
  foreach t in array array['exercise_library']
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
