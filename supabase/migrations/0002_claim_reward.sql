create or replace function public.claim_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_stall_id uuid;
  v_title text;
  v_kind text;
  v_is_active boolean;
  v_requires_verified_phone boolean;
  v_claims_count int;
  v_claim_limit int;
  v_phone_verified boolean;
  v_claim_id uuid;
  v_claim_code text;
  v_redeemed_at timestamptz;
begin
  if v_profile_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select r.stall_id, r.title, r.kind, r.is_active, r.requires_verified_phone, r.claims_count, r.claim_limit
  into v_stall_id, v_title, v_kind, v_is_active, v_requires_verified_phone, v_claims_count, v_claim_limit
  from public.rewards r
  join public.stalls s on s.id = r.stall_id
  join public.events e on e.id = s.event_id
  where r.id = p_reward_id
    and e.is_published
  for update of r;

  if v_stall_id is null then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'REWARD_UNAVAILABLE');
  end if;

  select c.id, c.code, c.redeemed_at
  into v_claim_id, v_claim_code, v_redeemed_at
  from public.claims c
  where c.reward_id = p_reward_id
    and c.profile_id = v_profile_id;

  if v_claim_id is not null then
    return pg_catalog.jsonb_build_object(
      'success', true,
      'claimId', v_claim_id,
      'code', v_claim_code,
      'title', v_title,
      'alreadyClaimed', true,
      'redeemed', v_redeemed_at is not null
    );
  end if;

  if not v_is_active then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'REWARD_UNAVAILABLE');
  end if;

  if v_kind not in ('voucher', 'prize') then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'REWARD_UNAVAILABLE');
  end if;

  if not exists (
    select 1 from public.checkins c
    where c.profile_id = v_profile_id and c.stall_id = v_stall_id
  ) then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'CHECKIN_REQUIRED');
  end if;

  if v_requires_verified_phone then
    select p.phone_verified into v_phone_verified
    from public.profiles p
    where p.id = v_profile_id;

    if not coalesce(v_phone_verified, false) then
      return pg_catalog.jsonb_build_object('success', false, 'error', 'PHONE_VERIFICATION_REQUIRED');
    end if;
  end if;

  if v_claims_count >= v_claim_limit then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'REWARD_SOLD_OUT');
  end if;

  insert into public.claims (reward_id, profile_id)
  values (p_reward_id, v_profile_id)
  returning id, code into v_claim_id, v_claim_code;

  update public.rewards
  set claims_count = claims_count + 1
  where id = p_reward_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'claimId', v_claim_id,
    'code', v_claim_code,
    'title', v_title,
    'alreadyClaimed', false,
    'redeemed', false
  );
end;
$$;

revoke all on function public.claim_reward(uuid) from public, anon;
grant execute on function public.claim_reward(uuid) to authenticated;
