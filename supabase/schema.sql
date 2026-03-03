-- PulseMeet schema + RLS
-- Run in Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();


-- Rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  visibility text not null default 'link' check (visibility in ('private','link')),
  created_at timestamptz not null default now()
);

-- Participants
create table if not exists public.room_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_room_created on public.messages(room_id, created_at);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.messages enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Rooms policies
drop policy if exists "rooms_insert_owner" on public.rooms;
create policy "rooms_insert_owner"
  on public.rooms for insert
  with check (auth.uid() = owner_id);

drop policy if exists "rooms_select_if_participant" on public.rooms;
create policy "rooms_select_if_participant"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_participants rp
      where rp.room_id = rooms.id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "rooms_delete_owner" on public.rooms;
create policy "rooms_delete_owner"
  on public.rooms for delete
  using (auth.uid() = owner_id);

-- Participants policies
drop policy if exists "participants_select_if_member" on public.room_participants;
create policy "participants_select_if_member"
  on public.room_participants for select
  using (
    exists (
      select 1 from public.room_participants rp
      where rp.room_id = room_participants.room_id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "participants_insert_self" on public.room_participants;
create policy "participants_insert_self"
  on public.room_participants for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
    )
  );

drop policy if exists "participants_delete_self" on public.room_participants;
create policy "participants_delete_self"
  on public.room_participants for delete
  using (auth.uid() = user_id);

-- Messages policies
drop policy if exists "messages_select_if_participant" on public.messages;
create policy "messages_select_if_participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.room_participants rp
      where rp.room_id = messages.room_id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_if_participant" on public.messages;
create policy "messages_insert_if_participant"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.room_participants rp
      where rp.room_id = messages.room_id and rp.user_id = auth.uid()
    )
  );
