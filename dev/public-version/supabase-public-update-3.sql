-- Spott (Gym Public project) : update 3 : profile pictures and group invite links.
-- Paste into the SQL editor of the GYM PUBLIC project (ref uxxdikfpazjgdipadblt). NOT the couple app's project.
-- Safe to run more than once. Until this is run the app simply doesn't show the two features.

-- ---------- 1. Profile pictures ----------
-- The profile stores the file's path; the picture itself sits in a public bucket, in a folder named after the owner.
alter table public.app_profiles add column if not exists avatar text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_profiles_avatar') then
    alter table public.app_profiles add constraint app_profiles_avatar
      check (avatar = '' or avatar ~ ('^' || id::text || '/[0-9]{10,16}\.jpg$')); -- only a file in your own folder
  end if;
end $$;
grant update (avatar) on public.app_profiles to authenticated;

-- Public bucket: a profile picture is shown to anyone who can see the profile, so its link needs no sign-in.
-- JPEG only, 512 KB at most (the app shrinks a picture to about 30 KB before uploading).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('app-avatars', 'app-avatars', true, 524288, array['image/jpeg'])
  on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/jpeg'];
drop policy if exists "app avatars add" on storage.objects;
drop policy if exists "app avatars remove" on storage.objects;
create policy "app avatars add" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app avatars remove" on storage.objects for delete to authenticated
  using (bucket_id = 'app-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 2. Group invite links ----------
-- A group can have one secret code. Anyone signed in who has the code can join; members can make, replace or switch off the code.
alter table public.app_convs add column if not exists invite text;
create unique index if not exists app_convs_invite on public.app_convs (invite) where invite is not null;

create or replace function public.app_group_link(c uuid, fresh boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if not public.app_member(c, auth.uid()) then raise exception 'not allowed'; end if;
  select invite into tok from public.app_convs where id = c and kind = 'group';
  if not found then raise exception 'not a group'; end if;
  if tok is null or fresh then
    tok := replace(gen_random_uuid()::text, '-', '');
    update public.app_convs set invite = tok where id = c;
  end if;
  return tok;
end $$;

create or replace function public.app_group_link_off(c uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_member(c, auth.uid()) then raise exception 'not allowed'; end if;
  update public.app_convs set invite = null where id = c and kind = 'group';
end $$;

-- What the "Join this group?" screen shows before you join: the name and how many people are in it. Nothing else.
create or replace function public.app_group_peek(tok text) returns table (id uuid, title text, members int, joined boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.title, (select count(*)::int from public.app_members m where m.conv_id = v.id),
         exists (select 1 from public.app_members m where m.conv_id = v.id and m.user_id = auth.uid())
  from public.app_convs v
  where auth.uid() is not null and tok ~ '^[0-9a-f]{32}$' and v.invite = tok and v.kind = 'group';
$$;

create or replace function public.app_group_join(tok text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c uuid;
begin
  if me is null then raise exception 'sign in'; end if;
  if tok is null or tok !~ '^[0-9a-f]{32}$' then raise exception 'bad link'; end if;
  select id into c from public.app_convs where invite = tok and kind = 'group';
  if c is null then raise exception 'bad link'; end if;
  if exists (select 1 from public.app_members where conv_id = c and user_id = me) then return c; end if;
  if (select count(*) from public.app_members where conv_id = c) >= 100 then raise exception 'group full'; end if;
  insert into public.app_members (conv_id, user_id) values (c, me) on conflict do nothing;
  return c;
end $$;

revoke execute on function public.app_group_link(uuid, boolean), public.app_group_link_off(uuid),
  public.app_group_peek(text), public.app_group_join(text) from public, anon;
grant execute on function public.app_group_link(uuid, boolean), public.app_group_link_off(uuid),
  public.app_group_peek(text), public.app_group_join(text) to authenticated;
