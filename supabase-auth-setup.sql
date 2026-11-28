-- Supabase Auth + Row Level Security
-- Jalankan di Supabase SQL Editor SETELAH membuat akun pertama lewat UI.

alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.ai_responses add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists ai_responses_user_id_idx on public.ai_responses(user_id);

alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.ai_responses enable row level security;

drop policy if exists "Users read own tasks" on public.tasks;
create policy "Users read own tasks" on public.tasks
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own tasks" on public.tasks;
create policy "Users insert own tasks" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own tasks" on public.tasks;
create policy "Users update own tasks" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own tasks" on public.tasks;
create policy "Users delete own tasks" on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read own notes" on public.notes;
create policy "Users read own notes" on public.notes
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own notes" on public.notes;
create policy "Users insert own notes" on public.notes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own notes" on public.notes;
create policy "Users update own notes" on public.notes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own notes" on public.notes;
create policy "Users delete own notes" on public.notes
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read own ai responses" on public.ai_responses;
create policy "Users read own ai responses" on public.ai_responses
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own ai responses" on public.ai_responses;
create policy "Users insert own ai responses" on public.ai_responses
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own ai responses" on public.ai_responses;
create policy "Users update own ai responses" on public.ai_responses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own ai responses" on public.ai_responses;
create policy "Users delete own ai responses" on public.ai_responses
  for delete to authenticated using (auth.uid() = user_id);

-- Data lama punya user_id NULL dan tidak akan terlihat setelah RLS aktif.
-- Setelah akun dibuat, jalankan baris di bawah untuk memindahkannya ke akun tersebut:
-- update public.tasks set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;
-- update public.notes set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;
-- update public.ai_responses set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;

-- wa_logs dan wa_sessions sengaja tidak memakai RLS karena diakses bot lewat service_role.
