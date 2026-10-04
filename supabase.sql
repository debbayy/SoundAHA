create table sounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('meme','music','trending')),
  audio_url text not null,
  thumbnail_url text,
  emoji text,
  duration int not null default 0,
  is_featured boolean not null default false
);

create table favorites (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  sound_id uuid not null references sounds on delete cascade,
  primary key (user_id, sound_id)
);

alter table sounds enable row level security;
alter table favorites enable row level security;

create policy "sounds are public" on sounds for select using (true);
create policy "own favorites" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Storage: create a public bucket "sounds" and upload only audio you own / have licensed.


-- Party (listen together): a song from someone's phone is shared through this PRIVATE bucket while a
-- party runs. Only logged-in users can upload, and only into their own folder (<user id>/<party code>/...);
-- the others download it through a signed link that expires after 6 hours. Each phone removes its own
-- files when it leaves the party, and the "party-cleanup" Edge Function (scheduled in
-- supabase/party-cleanup-schedule.sql) removes anything older than 6 hours that a crash left behind.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('party', 'party', false, 10485760, array['audio/*']) -- 10 MB, audio only
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "party upload" on storage.objects;
drop policy if exists "party update" on storage.objects;
drop policy if exists "party read" on storage.objects;
drop policy if exists "party delete" on storage.objects;

-- at most 30 files per user at a time (they are cleaned up after each party / within 6 hours)
create policy "party: upload into own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'party'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select count(*) from storage.objects o
         where o.bucket_id = 'party' and (storage.foldername(o.name))[1] = (select auth.uid())::text) < 30
  );
create policy "party: read own files" on storage.objects for select to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "party: replace own files" on storage.objects for update to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "party: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'party' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Account deletion (required by Google Play): lets a logged-in user delete their own account from the
-- app. It can only ever delete the caller; their favorites are removed with it (on delete cascade).
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

-- Freesound search cache, used only by the freesound-search Edge Function (service role). Every query
-- is fetched from Freesound once and shared by all users for 7 days. No policies: the app never reads
-- this table directly.
create table if not exists public.freesound_cache (
  query text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.freesound_cache enable row level security;
