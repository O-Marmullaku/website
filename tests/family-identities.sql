-- Run after trusted Family provisioning. Role probes and writes always roll back.
begin;
select set_config('marmullaku.test_identities',
  (select jsonb_agg(jsonb_build_object('id',id,'user_id',owner_user_id) order by id)::text
   from public.marmullaku_profiles), true);
do $identities$
declare
  member record;
  changed integer;
begin
  assert (select count(*) from public.marmullaku_profiles)=6, 'Six canonical profiles are required';
  assert (select count(*) from public.marmullaku_profiles p join auth.users u on u.id=p.owner_user_id
    where lower(p.invite_email)=lower(u.email) and u.email_confirmed_at is not null
      and u.is_anonymous is not true and coalesce(length(u.encrypted_password),0)>0)=6,
    'Each sibling needs a matching confirmed password account';
  for member in select * from jsonb_to_recordset(current_setting('marmullaku.test_identities')::jsonb)
    as m(id text,user_id uuid)
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',member.user_id,'role','authenticated','is_anonymous',false)::text,true);
    execute 'set local role authenticated';
    assert (select count(*) from public.marmullaku_profiles)=1, 'Account can read another sibling profile';
    assert (select id from public.marmullaku_profiles)=member.id, 'Account resolves to the wrong sibling';
    update public.marmullaku_profiles set role=role where id=member.id;
    get diagnostics changed=row_count;
    assert changed=1, 'Account cannot edit its own profile';
    update public.marmullaku_profiles set role=role where id<>member.id;
    get diagnostics changed=row_count;
    assert changed=0, 'Account can edit another sibling profile';
    execute 'reset role';
  end loop;
end $identities$;
rollback;
