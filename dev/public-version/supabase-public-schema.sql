-- Gym app (public version): run ONCE in a fresh Supabase project → SQL Editor → New query → Run.
-- Safe to run again. Also set: Authentication → Sign In / Providers → Email → turn OFF "Confirm email"
-- (accounts use username + password; the email behind each account is generated from the username).

create extension if not exists pgcrypto;

-- ============ profiles (username, display name, role) ============
create table if not exists public.app_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '',
  role         text not null default 'user' check (role in ('user','trainer')),
  color        text not null default '#ff9f0a',
  bio          text not null default '',
  created_at   timestamptz not null default now()
);

-- create the profile row from the sign-up metadata, in the same transaction as the account
create or replace function public.app_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_profiles (id, username, display_name, role, color)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
          coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), coalesce(new.raw_user_meta_data->>'username', '')),
          case when new.raw_user_meta_data->>'role' = 'trainer' then 'trainer' else 'user' end,
          coalesce(nullif(new.raw_user_meta_data->>'color', ''), '#ff9f0a'));
  return new;
end $$;
drop trigger if exists app_on_signup on auth.users;
create trigger app_on_signup after insert on auth.users for each row execute function public.app_new_user();

-- username check before sign-up (callable without logging in; returns only true/false)
create or replace function public.app_username_free(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(u) ~ '^[a-z0-9_.]{3,20}$' and not exists (select 1 from public.app_profiles where username = lower(u));
$$;
grant execute on function public.app_username_free(text) to anon, authenticated;

-- ============ connections ============
create table if not exists public.app_friends (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists app_friends_pair on public.app_friends (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.app_trainers (
  id         bigint generated always as identity primary key,
  client     uuid not null references auth.users(id) on delete cascade,
  trainer    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (client, trainer),
  check (client <> trainer)
);

create or replace function public.app_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_friends where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;
create or replace function public.app_trains(t uuid, c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_trainers where status = 'accepted' and trainer = t and client = c);
$$;
create or replace function public.app_linked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_are_friends(a, b) or public.app_trains(a, b) or public.app_trains(b, a);
$$;
create or replace function public.app_is_trainer(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_profiles where id = u and role = 'trainer');
$$;

-- ============ personal data ============
create table if not exists public.app_state (     -- logs, body, fuel, settings (owner; trainer can read)
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.app_routines (  -- the workout plan (owner and their trainer can edit)
  user_id    uuid primary key references auth.users(id) on delete cascade,
  routine    jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  note       text not null default ''
);
create table if not exists public.app_public (    -- the shareable summary friends see (leaderboard, live set)
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============ chats ============
create table if not exists public.app_convs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('dm','group','coach')),
  title      text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  last_text  text not null default ''
);
create table if not exists public.app_members (
  conv_id   uuid not null references public.app_convs(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  last_read timestamptz not null default now(),
  primary key (conv_id, user_id)
);
create table if not exists public.app_messages (
  id         bigint generated always as identity primary key,
  conv_id    uuid not null references public.app_convs(id) on delete cascade,
  sender     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text,
  photo      text,
  created_at timestamptz not null default now()
);
create index if not exists app_messages_conv on public.app_messages (conv_id, created_at desc);

create or replace function public.app_member(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_members where conv_id = c and user_id = u);
$$;

-- keep the inbox preview fresh
create or replace function public.app_bump_conv() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.app_convs set last_at = new.created_at,
    last_text = left(coalesce(nullif(new.body, ''), case when new.photo is not null then '📷 Photo' else '' end), 120)
  where id = new.conv_id;
  update public.app_members set last_read = new.created_at where conv_id = new.conv_id and user_id = new.sender;
  return new;
end $$;
drop trigger if exists app_msg_bump on public.app_messages;
create trigger app_msg_bump after insert on public.app_messages for each row execute function public.app_bump_conv();

-- open (or reuse) a 1-on-1 chat with a friend, or a coach chat between a trainer and client
create or replace function public.app_open_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k text; c uuid;
begin
  if me is null or other is null or other = me then raise exception 'bad user'; end if;
  if public.app_trains(me, other) or public.app_trains(other, me) then k := 'coach';
  elsif public.app_are_friends(me, other) then k := 'dm';
  else raise exception 'not connected'; end if;
  select m1.conv_id into c from public.app_members m1
    join public.app_members m2 on m2.conv_id = m1.conv_id and m2.user_id = other
    join public.app_convs v on v.id = m1.conv_id and v.kind = k
    where m1.user_id = me limit 1;
  if c is not null then return c; end if;
  insert into public.app_convs (kind, created_by) values (k, me) returning id into c;
  insert into public.app_members (conv_id, user_id) values (c, me), (c, other);
  return c;
end $$;

-- group chat with friends
create or replace function public.app_new_group(title text, people uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c uuid; p uuid;
begin
  if me is null then raise exception 'sign in'; end if;
  insert into public.app_convs (kind, title, created_by) values ('group', left(coalesce(title, ''), 40), me) returning id into c;
  insert into public.app_members (conv_id, user_id) values (c, me);
  foreach p in array coalesce(people, '{}') loop
    if p <> me and public.app_are_friends(me, p) then
      insert into public.app_members (conv_id, user_id) values (c, p) on conflict do nothing;
    end if;
  end loop;
  return c;
end $$;
create or replace function public.app_group_add(c uuid, p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_member(c, auth.uid()) or not public.app_are_friends(auth.uid(), p) then raise exception 'not allowed'; end if;
  if (select kind from public.app_convs where id = c) <> 'group' then raise exception 'not a group'; end if;
  insert into public.app_members (conv_id, user_id) values (c, p) on conflict do nothing;
end $$;
create or replace function public.app_group_rename(c uuid, t text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_member(c, auth.uid()) then raise exception 'not allowed'; end if;
  update public.app_convs set title = left(coalesce(t, ''), 40) where id = c and kind = 'group';
end $$;
grant execute on function public.app_open_chat(uuid), public.app_new_group(text, uuid[]),
  public.app_group_add(uuid, uuid), public.app_group_rename(uuid, text) to authenticated;

-- ============ notifications (nudges, routine edits from your trainer, accepted requests) ============
create table if not exists public.app_notes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,   -- who gets it
  from_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,
  body       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists app_notes_user on public.app_notes (user_id, created_at desc);

-- ============ row level security ============
alter table public.app_profiles enable row level security;
alter table public.app_friends  enable row level security;
alter table public.app_trainers enable row level security;
alter table public.app_state    enable row level security;
alter table public.app_routines enable row level security;
alter table public.app_public   enable row level security;
alter table public.app_convs    enable row level security;
alter table public.app_members  enable row level security;
alter table public.app_messages enable row level security;
alter table public.app_notes    enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'app\_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: anyone signed in can find people by username; you edit only yours (not your role)
create policy prof_read on public.app_profiles for select to authenticated using (true);
create policy prof_edit on public.app_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friends
create policy fr_read on public.app_friends for select to authenticated using (auth.uid() in (requester, addressee));
create policy fr_ask  on public.app_friends for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy fr_ok   on public.app_friends for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy fr_del  on public.app_friends for delete to authenticated using (auth.uid() in (requester, addressee));

-- trainers: the client asks, the trainer accepts, either can end it
create policy tr_read on public.app_trainers for select to authenticated using (auth.uid() in (client, trainer));
create policy tr_ask  on public.app_trainers for insert to authenticated with check (client = auth.uid() and status = 'pending' and public.app_is_trainer(trainer));
create policy tr_ok   on public.app_trainers for update to authenticated using (trainer = auth.uid()) with check (trainer = auth.uid());
create policy tr_del  on public.app_trainers for delete to authenticated using (auth.uid() in (client, trainer));

-- state: yours; your trainer can read it
create policy st_read  on public.app_state for select to authenticated using (user_id = auth.uid() or public.app_trains(auth.uid(), user_id));
create policy st_write on public.app_state for insert to authenticated with check (user_id = auth.uid());
create policy st_upd   on public.app_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- routine: you and your trainer
create policy rt_read  on public.app_routines for select to authenticated using (user_id = auth.uid() or public.app_trains(auth.uid(), user_id));
create policy rt_ins   on public.app_routines for insert to authenticated with check ((user_id = auth.uid() or public.app_trains(auth.uid(), user_id)) and updated_by = auth.uid());
create policy rt_upd   on public.app_routines for update to authenticated using (user_id = auth.uid() or public.app_trains(auth.uid(), user_id)) with check (updated_by = auth.uid());

-- public summary: you, your friends, your trainer
create policy pb_read  on public.app_public for select to authenticated using (user_id = auth.uid() or public.app_linked(auth.uid(), user_id));
create policy pb_write on public.app_public for insert to authenticated with check (user_id = auth.uid());
create policy pb_upd   on public.app_public for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- chats: members only
create policy cv_read on public.app_convs    for select to authenticated using (public.app_member(id, auth.uid()));
create policy mb_read on public.app_members  for select to authenticated using (public.app_member(conv_id, auth.uid()));
create policy mb_seen on public.app_members  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mb_quit on public.app_members  for delete to authenticated using (user_id = auth.uid());
create policy ms_read on public.app_messages for select to authenticated using (public.app_member(conv_id, auth.uid()));
create policy ms_send on public.app_messages for insert to authenticated with check (sender = auth.uid() and public.app_member(conv_id, auth.uid()));
create policy ms_del  on public.app_messages for delete to authenticated using (sender = auth.uid());

-- notes: only between connected people; you read and clear your own
create policy nt_read on public.app_notes for select to authenticated using (user_id = auth.uid());
create policy nt_send on public.app_notes for insert to authenticated with check (from_id = auth.uid() and (public.app_linked(auth.uid(), user_id) or kind in ('friend_req','trainer_req')));
create policy nt_upd  on public.app_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy nt_del  on public.app_notes for delete to authenticated using (user_id = auth.uid());

-- ============ live updates ============
do $$ declare t text; begin
  foreach t in array array['app_messages','app_notes','app_public','app_friends','app_trainers','app_routines','app_convs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ storage: progress photos (you + trainer read), chat photos (members) ============
insert into storage.buckets (id, name, public) values ('app-photos', 'app-photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('app-chat', 'app-chat', false) on conflict (id) do nothing;
drop policy if exists "app photos own" on storage.objects;
drop policy if exists "app photos trainer" on storage.objects;
drop policy if exists "app chat read" on storage.objects;
drop policy if exists "app chat send" on storage.objects;
create policy "app photos own" on storage.objects for all to authenticated
  using (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app photos trainer" on storage.objects for select to authenticated
  using (bucket_id = 'app-photos' and exists (select 1 from public.app_trainers t where t.status = 'accepted' and t.trainer = auth.uid() and t.client::text = (storage.foldername(name))[1]));
create policy "app chat read" on storage.objects for select to authenticated
  using (bucket_id = 'app-chat' and exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.conv_id::text = (storage.foldername(name))[1]));
create policy "app chat send" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-chat' and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.conv_id::text = (storage.foldername(name))[1]));
