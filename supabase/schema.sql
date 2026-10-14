-- Shared-project isolation: no changes to other applications or Auth settings.
create table public.marmullaku_profiles (
  id text primary key check (id in ('osman','diellza','drilona','drenusha','dredhza','ali')),
  owner_user_id uuid unique references auth.users(id) on delete restrict,
  invite_email text unique,
  display_name text not null check (length(display_name) between 1 and 100),
  role text not null default '' check (length(role) <= 160),
  cv jsonb not null default '{"contact":[],"skills":[],"languages":[],"profile":"","experience":[],"education":[],"certs":[],"interests":""}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.marmullaku_links (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.marmullaku_profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  company text not null check (length(company) between 1 and 120),
  message text not null default '' check (length(message) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false
);
create index marmullaku_links_profile_id_idx on public.marmullaku_links(profile_id);
create table public.marmullaku_archive_chunks (part integer primary key, content text not null);
alter table public.marmullaku_archive_chunks enable row level security;
revoke all on public.marmullaku_archive_chunks from anon, authenticated;
grant all on public.marmullaku_archive_chunks to service_role;
alter table public.marmullaku_profiles enable row level security;
alter table public.marmullaku_links enable row level security;
revoke all on public.marmullaku_profiles, public.marmullaku_links from anon, authenticated;
grant select on public.marmullaku_profiles to authenticated;
grant update (display_name, role, cv, updated_at) on public.marmullaku_profiles to authenticated;
grant select, insert on public.marmullaku_links to authenticated;
grant update (revoked) on public.marmullaku_links to authenticated;
grant all on public.marmullaku_profiles, public.marmullaku_links to service_role;
create policy "Marmullaku own profile read" on public.marmullaku_profiles for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy "Marmullaku named profile sessions" on public.marmullaku_profiles as restrictive for all to authenticated
  using ((select auth.jwt()->>'is_anonymous') is distinct from 'true') with check ((select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy "Marmullaku named link sessions" on public.marmullaku_links as restrictive for all to authenticated
  using ((select auth.jwt()->>'is_anonymous') is distinct from 'true') with check ((select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy "Marmullaku own profile edit" on public.marmullaku_profiles for update to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "Marmullaku own links read" on public.marmullaku_links for select to authenticated
  using (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())));
create policy "Marmullaku own links create" on public.marmullaku_links for insert to authenticated
  with check (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())));
create policy "Marmullaku own links revoke" on public.marmullaku_links for update to authenticated
  using (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.marmullaku_profiles p where p.id = profile_id and p.owner_user_id = (select auth.uid())));
insert into public.marmullaku_profiles (id, display_name) values
  ('osman','Osman Marmullaku'), ('diellza','Diellza Marmullaku'), ('drilona','Drilona Marmullaku'),
  ('drenusha','Drenusha Marmullaku'), ('dredhza','Dredhza Marmullaku'), ('ali','Ali Marmullaku');
-- Ownership is provisioned by a trusted operator, never by a signup form.
update public.marmullaku_profiles set invite_email = 'osman@marmullaku.ch', owner_user_id = (select id from auth.users where lower(email) = 'osman@marmullaku.ch' and email_confirmed_at is not null) where id = 'osman';
