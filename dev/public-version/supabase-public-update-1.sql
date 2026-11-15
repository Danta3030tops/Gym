-- Gym app (public version), update 1. Run once in the "Gym Public" project → SQL Editor. Safe to run again.
-- NEVER run this in the couple app's project.
-- What it does:
--   1. The helper functions now only answer questions about the person asking (before, any signed-in user could
--      call them directly and work out who is friends with, or coached by, whom).
--   2. Length limits on display names and bios.
--   3. Opening a 1-on-1 chat twice at the same moment can no longer create two chats.
--   4. Coaches can ask to see a client's progress photos; the client allows or declines and can withdraw it.

-- ============ 1. helpers answer only about the caller ============
create or replace function public.app_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() in (a, b) and exists (select 1 from public.app_friends where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;
create or replace function public.app_trains(t uuid, c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() in (t, c) and exists (select 1 from public.app_trainers where status = 'accepted' and trainer = t and client = c);
$$;
create or replace function public.app_member(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() and exists (select 1 from public.app_members where conv_id = c and user_id = u);
$$;
create or replace function public.app_can_post(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() and exists (select 1 from public.app_convs v where v.id = c and (v.kind = 'group' or exists (
    select 1 from public.app_members m where m.conv_id = c and m.user_id <> u and
      case v.kind when 'dm' then public.app_are_friends(u, m.user_id)
                  else public.app_trains(u, m.user_id) or public.app_trains(m.user_id, u) end)));
$$;
revoke execute on function public.app_are_friends(uuid, uuid), public.app_trains(uuid, uuid), public.app_linked(uuid, uuid),
  public.app_member(uuid, uuid), public.app_can_post(uuid, uuid), public.app_is_trainer(uuid) from anon;

-- ============ 2. length limits ============
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_profiles_len') then
    alter table public.app_profiles add constraint app_profiles_len check (char_length(display_name) <= 40 and char_length(bio) <= 300) not valid;
  end if;
end $$;

-- ============ 3. one 1-on-1 chat per pair ============
create or replace function public.app_open_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k text; c uuid;
begin
  if me is null or other is null or other = me then raise exception 'bad user'; end if;
  if public.app_trains(me, other) or public.app_trains(other, me) then k := 'coach';
  elsif public.app_are_friends(me, other) then k := 'dm';
  else raise exception 'not connected'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(me, other)::text || greatest(me, other)::text, 0)); -- two taps at once wait their turn
  select m1.conv_id into c from public.app_members m1
    join public.app_members m2 on m2.conv_id = m1.conv_id and m2.user_id = other
    join public.app_convs v on v.id = m1.conv_id and v.kind = k
    where m1.user_id = me limit 1;
  if c is not null then return c; end if;
  insert into public.app_convs (kind, created_by) values (k, me) returning id into c;
  insert into public.app_members (conv_id, user_id) values (c, me), (c, other);
  return c;
end $$;

-- ============ 4. progress photos: the coach asks, the client decides ============
alter table public.app_trainers add column if not exists photos text not null default 'no';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_trainers_photos') then
    alter table public.app_trainers add constraint app_trainers_photos check (photos in ('no', 'asked', 'yes'));
  end if;
end $$;
-- the coach asks (only moves 'no' → 'asked', so asking again cannot undo a client's choice)
create or replace function public.app_photos_ask(c uuid) returns void
language sql security definer set search_path = public as $$
  update public.app_trainers set photos = 'asked' where trainer = auth.uid() and client = c and status = 'accepted' and photos = 'no';
$$;
-- the client answers, and can change their mind at any time
create or replace function public.app_photos_answer(t uuid, ok boolean) returns void
language sql security definer set search_path = public as $$
  update public.app_trainers set photos = case when ok then 'yes' else 'no' end where client = auth.uid() and trainer = t and status = 'accepted';
$$;
revoke execute on function public.app_photos_ask(uuid), public.app_photos_answer(uuid, boolean) from public, anon;
grant execute on function public.app_photos_ask(uuid), public.app_photos_answer(uuid, boolean) to authenticated;

drop policy if exists "app photos trainer" on storage.objects;
create policy "app photos trainer" on storage.objects for select to authenticated
  using (bucket_id = 'app-photos' and exists (select 1 from public.app_trainers t
    where t.status = 'accepted' and t.photos = 'yes' and t.trainer = auth.uid() and t.client::text = (storage.foldername(name))[1]));
