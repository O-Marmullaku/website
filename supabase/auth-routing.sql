-- Preserve shared Cards signup behavior; explicit Marmullaku invitations grant no game membership.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text; v_name text; v_emoji text;
begin
  if new.raw_user_meta_data->>'app' = 'marmullaku' then return new; end if;
  if new.is_anonymous is true and new.raw_user_meta_data->>'app' in ('coach','tutor') then return new; end if;
  v_kind := case when coalesce(new.is_anonymous, false) then 'guest' else 'registered' end;
  v_name := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Player');
  v_emoji := coalesce(nullif(new.raw_user_meta_data->>'emoji', ''), '🦊');
  insert into public.account (id, status, kind, created_at, upgraded_at)
  values (new.id, 'active', v_kind, now(), case when v_kind = 'registered' then now() else null end) on conflict (id) do nothing;
  insert into public.profile (account_id, display_name, emoji, prefs, created_at, updated_at)
  values (new.id, v_name, v_emoji, '{}'::jsonb, now(), now()) on conflict (account_id) do nothing;
  return new;
end;
$$;
