alter table public.vendor_applications
  alter column stall_number drop not null,
  alter column zone_id drop not null,
  alter column map_x drop not null,
  alter column map_y drop not null;

drop function public.review_vendor_application(uuid, text, text, uuid);

create function public.review_vendor_application(
  p_application_id uuid,
  p_status text,
  p_review_notes text,
  p_reviewed_by uuid,
  p_stall_number text,
  p_zone_id uuid,
  p_map_x int,
  p_map_y int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.vendor_applications%rowtype;
  v_stall_id uuid;
  v_reward_id uuid;
  v_stall_number text;
  v_zone_id uuid;
  v_map_x int;
  v_map_y int;
begin
  if p_status not in ('needs_changes', 'approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_REVIEW_STATUS';
  end if;
  if p_review_notes is not null and length(p_review_notes) > 1000 then
    raise exception using errcode = '22023', message = 'REVIEW_NOTES_TOO_LONG';
  end if;

  select * into v_application
  from public.vendor_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'APPLICATION_NOT_FOUND';
  end if;
  if v_application.status = 'approved' and p_status <> 'approved' then
    raise exception using errcode = '23514', message = 'APPLICATION_ALREADY_APPROVED';
  end if;

  if p_status = 'approved' then
    if v_application.status = 'approved' then
      v_stall_number := v_application.stall_number;
      v_zone_id := v_application.zone_id;
      v_map_x := v_application.map_x;
      v_map_y := v_application.map_y;

      select id into v_stall_id
      from public.stalls
      where event_id = v_application.event_id
        and stall_number = v_stall_number;

      if v_stall_id is null then
        raise exception using errcode = 'P0001', message = 'APPROVED_STALL_NOT_FOUND';
      end if;

      select id into v_reward_id
      from public.rewards
      where stall_id = v_stall_id
        and title = v_application.gift_title
        and description = coalesce(v_application.gift_details, '')
      order by id
      limit 1;
    else
      v_stall_number := coalesce(nullif(btrim(p_stall_number), ''), v_application.stall_number);
      v_zone_id := coalesce(p_zone_id, v_application.zone_id);
      v_map_x := coalesce(p_map_x, v_application.map_x);
      v_map_y := coalesce(p_map_y, v_application.map_y);

      if v_stall_number is null
        or v_stall_number !~* '^[a-z0-9 _-]+$'
        or v_zone_id is null
        or v_map_x is null or v_map_x < 0 or v_map_x > 960
        or v_map_y is null or v_map_y < 0 or v_map_y > 700
      then
        raise exception using errcode = '22023', message = 'STALL_ASSIGNMENT_REQUIRED';
      end if;

      if not exists (
        select 1 from public.zones z
        where z.id = v_zone_id and z.event_id = v_application.event_id
      ) then
        raise exception using errcode = '22023', message = 'INVALID_STALL_ZONE';
      end if;

      insert into public.stalls (
        event_id, zone_id, stall_number, title, category, description,
        whatsapp_number, website_url, map_x, map_y
      )
      values (
        v_application.event_id, v_zone_id, v_stall_number,
        v_application.business_name, v_application.category, v_application.description,
        v_application.whatsapp, v_application.website_url, v_map_x, v_map_y
      )
      returning id into v_stall_id;

      if v_application.gift_title is not null then
        insert into public.rewards (stall_id, title, description, kind, claim_limit, is_active)
        values (
          v_stall_id, v_application.gift_title, v_application.gift_details,
          'voucher', v_application.gift_quantity, true
        )
        returning id into v_reward_id;
      end if;
    end if;

    update public.vendor_applications
    set stall_number = v_stall_number,
        zone_id = v_zone_id,
        map_x = v_map_x,
        map_y = v_map_y
    where id = p_application_id;
  end if;

  update public.vendor_applications
  set status = p_status,
      review_notes = nullif(btrim(p_review_notes), ''),
      reviewed_by = p_reviewed_by,
      reviewed_at = now()
  where id = p_application_id;

  return jsonb_build_object(
    'success', true,
    'status', p_status,
    'stallId', v_stall_id,
    'rewardId', v_reward_id
  );
end;
$$;

revoke all on function public.review_vendor_application(uuid, text, text, uuid, text, uuid, int, int)
  from public, anon, authenticated;
grant execute on function public.review_vendor_application(uuid, text, text, uuid, text, uuid, int, int)
  to service_role;
