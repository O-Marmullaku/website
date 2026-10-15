-- Run on Family Database. All fixtures and attempted changes roll back.
begin;
select set_config('marmullaku.test_owner', gen_random_uuid()::text, true);
select set_config('marmullaku.test_cards', gen_random_uuid()::text, true);
select set_config('marmullaku.test_coach', gen_random_uuid()::text, true);
select set_config('marmullaku.test_tutor', gen_random_uuid()::text, true);
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data, is_anonymous, created_at, updated_at)
select current_setting('marmullaku.test_owner')::uuid, 'authenticated','authenticated', 'marmullaku-'||gen_random_uuid()::text||'@example.invalid', now(), '{"app":"marmullaku"}', false, now(), now();
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data, is_anonymous, created_at, updated_at)
select current_setting('marmullaku.test_cards')::uuid, 'authenticated','authenticated', 'cards-'||gen_random_uuid()::text||'@example.invalid', now(), jsonb_build_object('display_name','Probe'||substr(gen_random_uuid()::text,1,8)), false, now(), now();
insert into auth.users (id, aud, role, raw_user_meta_data, is_anonymous, created_at, updated_at)
values (current_setting('marmullaku.test_coach')::uuid,'authenticated','authenticated','{"app":"coach"}',true,now(),now()),
       (current_setting('marmullaku.test_tutor')::uuid,'authenticated','authenticated','{"app":"tutor"}',true,now(),now());
do $$ begin
  assert to_regclass('public.account') is null, 'Work tables remain in Family Database';
  assert to_regclass('public.accounts') is null, 'Portica tables remain in Family Database';
end $$;
update public.marmullaku_profiles set owner_user_id=current_setting('marmullaku.test_owner')::uuid where id='diellza' and owner_user_id is null;
set local role anon;
do $$ begin
  begin perform * from public.marmullaku_profiles; raise exception 'Anonymous CV access allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.marmullaku_links; raise exception 'Anonymous link access allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.marmullaku_archive_chunks; raise exception 'Anonymous archive access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('marmullaku.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare changed integer; begin
  assert (select count(*) from public.marmullaku_profiles)=1, 'Owner isolation failed';
  assert (select id from public.marmullaku_profiles)='diellza', 'Wrong profile visible';
  update public.marmullaku_profiles set role='Probe' where id='diellza'; get diagnostics changed = row_count; assert changed=1, 'Own edit denied';
  update public.marmullaku_profiles set role='Probe' where id='osman'; get diagnostics changed = row_count; assert changed=0, 'Other sibling edit allowed';
  begin update public.marmullaku_profiles set owner_user_id=current_setting('marmullaku.test_owner')::uuid where id='diellza'; raise exception 'Ownership editable'; exception when insufficient_privilege then null; end;
  begin insert into public.marmullaku_links(profile_id,token_hash,company,expires_at) values('osman',repeat('f',64),'Probe',now()+interval '1 day'); raise exception 'Other sibling link allowed'; exception when insufficient_privilege then null; end;
  insert into public.marmullaku_links(profile_id,token_hash,company,expires_at) values('diellza',repeat('e',64),'Probe',now()+interval '1 day');
  assert (select count(*) from public.marmullaku_links)=1, 'Link isolation failed';
  insert into public.marmullaku_family(owner_id,recipient_id) values('diellza','osman');
  assert (select count(*) from public.marmullaku_family)=1, 'Family grant isolation failed';
  begin insert into public.marmullaku_family(owner_id,recipient_id) values('osman','diellza'); raise exception 'Other owner sharing allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.marmullaku_assets(profile_id,path,name,mime,bytes) values('diellza','../../another-app/private.pdf','Probe','application/pdf',10); raise exception 'Direct asset insertion allowed'; exception when insufficient_privilege then null; end;
  assert not has_table_privilege('authenticated','public.marmullaku_activity','INSERT'), 'Activity spoofing allowed';
  assert not has_table_privilege('anon','public.marmullaku_family','SELECT'), 'Public family access allowed';
  assert not has_table_privilege('anon','public.marmullaku_assets','SELECT'), 'Public asset access allowed';
  assert not has_table_privilege('anon','public.marmullaku_activity','SELECT'), 'Public activity access allowed';
  begin perform * from public.marmullaku_archive_chunks; raise exception 'Direct archive access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert exists(select 1 from storage.buckets where id='marmullaku-private' and public=false), 'Private bucket missing';
  assert exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Marmullaku files require the application gateway' and permissive='RESTRICTIVE'), 'Storage gateway isolation missing';
  begin insert into public.marmullaku_assets(profile_id,path,name,mime,bytes) values('diellza','../../another-app/private.pdf','Probe','application/pdf',10); raise exception 'Unsafe storage path accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('marmullaku.test_owner'),'role','authenticated','is_anonymous',true)::text,true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.marmullaku_profiles)=0, 'Anonymous session saw an owned profile';
  assert (select count(*) from public.marmullaku_links)=0, 'Anonymous session saw owned links';
end $$;
reset role;
rollback;
