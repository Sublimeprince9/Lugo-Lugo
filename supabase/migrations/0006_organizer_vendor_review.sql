alter table public.stalls
  add column website_url text;

alter table public.rewards
  add column description text not null default '';

grant select (website_url) on public.stalls to anon, authenticated;

create or replace view public.stalls_public
with (security_invoker = true)
as
select
  s.id,
  s.event_id,
  e.slug as event_slug,
  s.zone_id,
  z.name as zone,
  s.stall_number,
  s.title,
  s.category,
  s.description,
  s.whatsapp_number,
  s.map_x,
  s.map_y,
  s.checkin_coins,
  s.price_range,
  s.is_featured,
  s.media,
  s.products,
  s.website_url
from public.stalls s
join public.events e on e.id = s.event_id
left join public.zones z on z.id = s.zone_id;

create or replace function public.review_vendor_application(
  p_application_id uuid,
  p_status text,
  p_review_notes text,
  p_reviewed_by uuid
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
      select id into v_stall_id
      from public.stalls
      where event_id = v_application.event_id
        and stall_number = v_application.stall_number;

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
      insert into public.stalls (
        event_id, zone_id, stall_number, title, category, description,
        whatsapp_number, website_url, map_x, map_y
      )
      values (
        v_application.event_id, v_application.zone_id, v_application.stall_number,
        v_application.business_name, v_application.category, v_application.description,
        v_application.whatsapp, v_application.website_url, v_application.map_x, v_application.map_y
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

revoke all on function public.review_vendor_application(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.review_vendor_application(uuid, text, text, uuid)
  to service_role;
