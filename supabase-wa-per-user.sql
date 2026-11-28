-- Nomor WhatsApp tujuan per user
-- Jalankan di Supabase SQL Editor.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text,
  notifications_enabled boolean not null default true,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_wa_format;
alter table public.profiles add constraint profiles_wa_format
  check (whatsapp_number is null or whatsapp_number ~ '^62[0-9]{8,15}$');

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own profile" on public.profiles;
create policy "Users delete own profile" on public.profiles
  for delete to authenticated using (auth.uid() = user_id);

-- Isi nomor untuk akun yang sudah ada. Ganti email dan nomor bila perlu.
insert into public.profiles (user_id, whatsapp_number)
select id, '6283826314165' from auth.users where email = 'tylenol@gmail.com'
on conflict (user_id) do update
  set whatsapp_number = excluded.whatsapp_number
  where public.profiles.whatsapp_number is null;
