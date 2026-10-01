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
