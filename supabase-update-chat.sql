-- Run this ONCE in Supabase → SQL Editor → New query → Run.
-- Turns on the Chat tab: text messages and photos between your two accounts, delivered live.
-- Safe to run more than once.

create table if not exists public.gym_messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile    text not null,
  body       text,
  photo      text,
  created_at timestamptz not null default now()
);
create index if not exists gym_messages_created on public.gym_messages (created_at desc);
alter table public.gym_messages enable row level security;
drop policy if exists "read chat" on public.gym_messages;
drop policy if exists "send chat" on public.gym_messages;
drop policy if exists "delete own chat" on public.gym_messages;
create policy "read chat" on public.gym_messages for select to authenticated using (true);
create policy "send chat" on public.gym_messages for insert to authenticated with check (auth.uid() = sender);
create policy "delete own chat" on public.gym_messages for delete to authenticated using (auth.uid() = sender);

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gym_messages') then
    alter publication supabase_realtime add table public.gym_messages;
  end if;
end $$;

-- Private bucket for chat photos (only signed-in users can see them)
insert into storage.buckets (id, name, public) values ('chat-photos', 'chat-photos', false)
on conflict (id) do nothing;
drop policy if exists "chat photos read" on storage.objects;
drop policy if exists "chat photos upload" on storage.objects;
drop policy if exists "chat photos delete own" on storage.objects;
create policy "chat photos read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos');
create policy "chat photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
