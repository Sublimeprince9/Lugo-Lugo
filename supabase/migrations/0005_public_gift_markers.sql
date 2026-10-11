create or replace view public.stall_gift_markers
with (security_barrier = true)
as
select
  s.stall_number,
  e.slug as event_slug,
  exists (
    select 1
    from public.rewards r
    where r.stall_id = s.id
      and r.is_active
      and r.kind in ('voucher', 'prize')
      and r.claims_count < r.claim_limit
  ) as has_gift_reward
from public.stalls s
join public.events e on e.id = s.event_id
where e.is_published;

revoke all on public.stall_gift_markers from public, anon, authenticated;
grant select on public.stall_gift_markers to anon, authenticated;
