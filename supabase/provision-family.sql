-- Trusted operator only. Run against Family Database, never a work project.
-- Supply a JSON array in the session setting marmullaku.profile_accounts:
-- [{"id":"canonical-sibling-id","email":"confirmed-account-email","user_id":"verified-auth-uuid"}, ...]
-- Requires all six identities. Existing CVs, roles, names and files are preserved.
begin;
-- Insert the transaction-local set_config call here in a private operator copy.
-- Never commit a copy containing account emails or Auth IDs.
do $provision$
declare
  mapping jsonb := nullif(current_setting('marmullaku.profile_accounts', true), '')::jsonb;
  member record;
  account record;
  existing record;
  names constant jsonb := '{"osman":"Osman Marmullaku","diellza":"Diellza Marmullaku","drilona":"Drilona Marmullaku","drenusha":"Drenusha Marmullaku","dredhza":"Dredhza Marmullaku","ali":"Ali Marmullaku"}';
begin
  if jsonb_typeof(mapping) is distinct from 'array' then
    raise exception 'Supply the six verified Family account mappings first';
  end if;
  if jsonb_array_length(mapping) <> 6
     or (select count(distinct value->>'id') from jsonb_array_elements(mapping)) <> 6
     or (select count(distinct value->>'user_id') from jsonb_array_elements(mapping)) <> 6
     or (select count(distinct lower(value->>'email')) from jsonb_array_elements(mapping)) <> 6 then
    raise exception 'Exactly six distinct sibling identities, emails and Auth IDs are required';
  end if;
  for member in
    select * from jsonb_to_recordset(mapping) as m(id text, email text, user_id uuid) order by id
  loop
    if member.id is null or not names ? member.id or nullif(trim(member.email), '') is null then
      raise exception 'Unknown sibling identity or missing email';
    end if;
    select id, email, email_confirmed_at, is_anonymous,
      coalesce(length(encrypted_password), 0) > 0 as has_password
      into account from auth.users where id=member.user_id for share;
    if not found or lower(account.email) is distinct from lower(member.email)
       or account.email_confirmed_at is null or account.is_anonymous is true
       or not account.has_password then
      raise exception 'Verified confirmed password account missing for %', member.id;
    end if;
    select owner_user_id, invite_email into existing
      from public.marmullaku_profiles where id=member.id for update;
    if found and (
      (existing.owner_user_id is not null and existing.owner_user_id <> account.id)
      or (existing.invite_email is not null and lower(existing.invite_email) <> lower(account.email))
    ) then
      raise exception 'Existing ownership or invitation conflicts for %; no mappings changed', member.id;
    end if;
    insert into public.marmullaku_profiles as p (id, display_name, invite_email, owner_user_id)
      values (member.id, names->>member.id, lower(account.email), account.id)
      on conflict (id) do update set
        invite_email=excluded.invite_email, owner_user_id=excluded.owner_user_id, updated_at=now()
      where (p.owner_user_id is null or p.owner_user_id=excluded.owner_user_id)
        and (p.invite_email is null or lower(p.invite_email)=excluded.invite_email)
        and (p.invite_email is distinct from excluded.invite_email
          or p.owner_user_id is distinct from excluded.owner_user_id);
    if not exists (select 1 from public.marmullaku_profiles
      where id=member.id and owner_user_id=account.id and invite_email=lower(account.email)) then
      raise exception 'Ownership changed concurrently for %; no mappings changed', member.id;
    end if;
  end loop;
end $provision$;
commit;
