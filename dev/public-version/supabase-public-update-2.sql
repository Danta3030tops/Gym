-- Spott (Gym Public project) : hardening update 2, from the 16 Nov security review.
-- Paste into the SQL editor of the GYM PUBLIC project (ref uxxdikfpazjgdipadblt). NOT the couple app's project.
-- Safe to run more than once. Nothing here changes what the app can do today: it only puts ceilings on sizes,
-- so one account can't stuff huge rows or files into the database and slow down a friend's or a coach's phone.
-- Every limit is "not valid", which means it applies to new and changed rows only; rows already there are left alone.

-- 1. Size ceilings on text and JSON that other people's phones have to download.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_messages_len') then
    alter table public.app_messages add constraint app_messages_len check (char_length(coalesce(body, '')) <= 4000 and char_length(coalesce(photo, '')) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_notes_len') then
    alter table public.app_notes add constraint app_notes_len check (char_length(kind) <= 30 and char_length(body) <= 500 and pg_column_size(data) <= 4096) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_profiles_color') then
    alter table public.app_profiles add constraint app_profiles_color check (color ~ '^#[0-9a-fA-F]{6}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_routines_size') then
    alter table public.app_routines add constraint app_routines_size check (pg_column_size(routine) <= 300000 and char_length(note) <= 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_public_size') then
    alter table public.app_public add constraint app_public_size check (pg_column_size(data) <= 100000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_state_size') then
    alter table public.app_state add constraint app_state_size check (pg_column_size(data) <= 8000000) not valid;
  end if;
end $$;

-- 2. Photo buckets: images only, 6 MB each (the app shrinks photos to well under 1 MB before uploading).
update storage.buckets set file_size_limit = 6291456, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('app-photos', 'app-chat');

-- 3. The helper functions that take no part in sign-up should not be callable by someone who isn't signed in.
revoke execute on function public.app_open_chat(uuid), public.app_new_group(text, uuid[]),
  public.app_group_add(uuid, uuid), public.app_group_rename(uuid, text) from public, anon;
grant execute on function public.app_open_chat(uuid), public.app_new_group(text, uuid[]),
  public.app_group_add(uuid, uuid), public.app_group_rename(uuid, text) to authenticated;
