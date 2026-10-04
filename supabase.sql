-- Soundly database setup. Safe to run again: everything is created only if missing, and policies /
-- functions are replaced. Run the whole file in Supabase → SQL Editor.

-- ---- Catalog and favorites ------------------------------------------------------------------
create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('meme','music','trending')),
  audio_url text not null, -- https link; host files without bandwidth charges (see supabase/README.md)
  thumbnail_url text,
  emoji text,
  duration int not null default 0,
  is_featured boolean not null default false
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  sound_id uuid not null references public.sounds on delete cascade,
  primary key (user_id, sound_id)
);

alter table public.sounds enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "sounds are public" on public.sounds;
create policy "sounds are public" on public.sounds for select using (true);
drop policy if exists "own favorites" on public.favorites;
create policy "own favorites" on public.favorites for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---- Party (listen together) ----------------------------------------------------------------
-- A song from someone's phone is shared through this PRIVATE bucket while a party runs. Only logged-in
-- users can upload, and only into their own folder (<user id>/<party code>/...); the others download it
-- through a signed link that expires after 6 hours. Each phone removes its own files when it leaves the
-- party, and the "party-cleanup" Edge Function (scheduled in supabase/party-cleanup-schedule.sql)
-- removes anything older than 6 hours that a crash left behind.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('party', 'party', false, 10485760, array['audio/*']) -- 10 MB, audio only
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- How many party files a user has right now (for the 30-file limit). A function, so the upload rule
-- does not query storage.objects from inside its own policy.
create or replace function public.party_file_count(uid text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from storage.objects
  where bucket_id = 'party' and (storage.foldername(name))[1] = uid;
$$;
revoke all on function public.party_file_count(text) from public, anon;
grant execute on function public.party_file_count(text) to authenticated;

drop policy if exists "party upload" on storage.objects;
drop policy if exists "party update" on storage.objects;
drop policy if exists "party read" on storage.objects;
drop policy if exists "party delete" on storage.objects;
drop policy if exists "party: upload into own folder" on storage.objects;
drop policy if exists "party: read own files" on storage.objects;
drop policy if exists "party: replace own files" on storage.objects;
drop policy if exists "party: delete own files" on storage.objects;

-- at most 30 files per user at a time (they are cleaned up after each party / within 6 hours)
create policy "party: upload into own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'party'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.party_file_count((select auth.uid())::text) < 30
  );
create policy "party: read own files" on storage.objects for select to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "party: replace own files" on storage.objects for update to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "party: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- Account deletion (required by Google Play) ---------------------------------------------
-- Lets a logged-in user delete their own account from the app. It can only ever delete the caller;
-- their favorites are removed with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not logged in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---- Freesound search cache -----------------------------------------------------------------
-- Used only by the freesound-search Edge Function (service role). Every query is fetched from
-- Freesound once and shared by all users for 7 days. No policies: the app never reads it directly.
create table if not exists public.freesound_cache (
  query text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.freesound_cache enable row level security;

-- make the API see the new functions right away
notify pgrst, 'reload schema';
