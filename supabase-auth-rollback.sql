-- Rollback untuk supabase-auth-setup.sql
-- Jalankan ini HANYA jika deploy auth bermasalah dan ingin kembali ke versi lama.

drop policy if exists "Users read own tasks" on public.tasks;
drop policy if exists "Users insert own tasks" on public.tasks;
drop policy if exists "Users update own tasks" on public.tasks;
drop policy if exists "Users delete own tasks" on public.tasks;
drop policy if exists "Users read own notes" on public.notes;
drop policy if exists "Users insert own notes" on public.notes;
drop policy if exists "Users update own notes" on public.notes;
drop policy if exists "Users delete own notes" on public.notes;
drop policy if exists "Users read own ai responses" on public.ai_responses;
drop policy if exists "Users insert own ai responses" on public.ai_responses;
drop policy if exists "Users update own ai responses" on public.ai_responses;
drop policy if exists "Users delete own ai responses" on public.ai_responses;

alter table public.tasks disable row level security;
alter table public.notes disable row level security;
alter table public.ai_responses disable row level security;

drop index if exists tasks_user_id_idx;
drop index if exists notes_user_id_idx;
drop index if exists ai_responses_user_id_idx;

alter table public.tasks drop column if exists user_id;
alter table public.notes drop column if exists user_id;
alter table public.ai_responses drop column if exists user_id;
