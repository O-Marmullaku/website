-- Marmullaku only: preserve other applications and existing grants.
alter table public.marmullaku_links alter column expires_at drop not null;
alter table public.marmullaku_links add column encrypted_token text;

create table public.marmullaku_family (
  owner_id text not null references public.marmullaku_profiles(id),
  recipient_id text not null references public.marmullaku_profiles(id),
  enabled boolean not null default true,
  primary key (owner_id, recipient_id),
  check (owner_id <> recipient_id)
);
create index marmullaku_family_recipient_idx on public.marmullaku_family(recipient_id) where enabled;
alter table public.marmullaku_family enable row level security;
revoke all on public.marmullaku_family from anon, authenticated;
grant select, insert, update on public.marmullaku_family to authenticated;
grant all on public.marmullaku_family to service_role;
create policy "Marmullaku owner controls family sharing" on public.marmullaku_family for all to authenticated
  using (exists (select 1 from public.marmullaku_profiles p where p.id = owner_id and p.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.marmullaku_profiles p where p.id = owner_id and p.owner_user_id = (select auth.uid())));

create table public.marmullaku_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.marmullaku_profiles(id),
  path text not null unique,
  name text not null check (length(name) between 1 and 180),
  mime text not null check (mime in ('application/pdf','image/png','image/jpeg','image/webp')),
  bytes integer not null check (bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (path = profile_id || '/' || id::text || '.' || case mime when 'application/pdf' then 'pdf' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end)
);
create index marmullaku_assets_profile_idx on public.marmullaku_assets(profile_id);
alter table public.marmullaku_assets enable row level security;
revoke all on public.marmullaku_assets from anon, authenticated;
grant select on public.marmullaku_assets to authenticated;
grant update (deleted_at) on public.marmullaku_assets to authenticated;
grant all on public.marmullaku_assets to service_role;
create policy "Marmullaku owner assets" on public.marmullaku_assets for all to authenticated
  using (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())));

create table public.marmullaku_activity (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.marmullaku_links(id) on delete cascade,
  profile_id text not null references public.marmullaku_profiles(id),
  kind text not null check (kind in ('visit','cv','document','picture','link','button')),
  label text not null check (length(label) <= 250),
  created_at timestamptz not null default now()
);
create index marmullaku_activity_link_time_idx on public.marmullaku_activity(link_id, created_at desc);
create index marmullaku_activity_profile_idx on public.marmullaku_activity(profile_id);
alter table public.marmullaku_activity enable row level security;
revoke all on public.marmullaku_activity from anon, authenticated;
grant select on public.marmullaku_activity to authenticated;
grant all on public.marmullaku_activity to service_role;
create policy "Marmullaku sender reads link activity" on public.marmullaku_activity for select to authenticated
  using (exists (select 1 from public.marmullaku_links l join public.marmullaku_profiles p on p.id = l.profile_id where l.id = link_id and p.owner_user_id = (select auth.uid())));

-- All file reads and writes go through the authenticated Edge Function.
-- Do not grant direct object access, including to other shared-project apps.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('marmullaku-private','marmullaku-private',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']);
create policy "Marmullaku files require the application gateway" on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'marmullaku-private') with check (bucket_id <> 'marmullaku-private');
