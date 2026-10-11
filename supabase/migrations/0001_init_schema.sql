create extension if not exists "pgcrypto";

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  map_config jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  map_bounds jsonb not null default '{}'::jsonb,
  unique (event_id, name)
);

create table public.stalls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete set null,
  stall_number text not null,
  title text not null,
  category text not null check (category in ('Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech', 'Other')),
  description text not null default '',
  whatsapp_number text,
  map_x int not null,
  map_y int not null,
  checkin_coins int not null default 60 check (checkin_coins >= 0),
  price_range text,
  is_featured boolean not null default false,
  media jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  qr_secret text not null default encode(gen_random_bytes(32), 'hex'),
  owner_id uuid references auth.users(id) on delete set null,
  unique (event_id, stall_number)
);
create index stalls_event_category_idx on public.stalls (event_id, category);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Explorer',
  phone_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.event_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  coins int not null default 0 check (coins >= 0),
  stalls_visited int not null default 0 check (stalls_visited >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stall_id uuid not null references public.stalls(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, stall_id)
);
create index checkins_profile_event_idx on public.checkins (profile_id, event_id);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  stall_id uuid not null references public.stalls(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('coins', 'voucher', 'prize')),
  coin_value int not null default 0 check (coin_value >= 0),
  claim_limit int not null default 100 check (claim_limit >= 0),
  claims_count int not null default 0 check (claims_count >= 0),
  requires_verified_phone boolean not null default false,
  is_active boolean not null default true
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null default encode(gen_random_bytes(6), 'hex'),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reward_id, profile_id)
);

create table public.track_events (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  stall_id uuid references public.stalls(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('stall_tap', 'whatsapp_click', 'checkin', 'claim', 'filter_use')),
  created_at timestamptz not null default now()
);
create index track_events_stall_kind_created_idx on public.track_events (stall_id, kind, created_at);

create table public.checkin_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index checkin_attempts_profile_created_idx on public.checkin_attempts (profile_id, created_at);
create index checkin_attempts_ip_created_idx on public.checkin_attempts (ip_hash, created_at);

alter table public.events enable row level security;
alter table public.zones enable row level security;
alter table public.stalls enable row level security;
alter table public.profiles enable row level security;
alter table public.event_progress enable row level security;
alter table public.checkins enable row level security;
alter table public.rewards enable row level security;
alter table public.claims enable row level security;
alter table public.track_events enable row level security;
alter table public.checkin_attempts enable row level security;

create policy "Published events are public"
  on public.events for select to anon, authenticated
  using (is_published);

create policy "Zones for published events are public"
  on public.zones for select to anon, authenticated
  using (exists (
    select 1 from public.events e
    where e.id = zones.event_id and e.is_published
  ));

create policy "Published stalls are public"
  on public.stalls for select to anon, authenticated
  using (exists (
    select 1 from public.events e
    where e.id = stalls.event_id and e.is_published
  ));

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own username"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can read their own event progress"
  on public.event_progress for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Users can read their own check-ins"
  on public.checkins for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Active rewards at published stalls are public"
  on public.rewards for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.stalls s
      join public.events e on e.id = s.event_id
      where s.id = rewards.stall_id and e.is_published
    )
  );

create policy "Users can read their own claims"
  on public.claims for select to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.is_stall_owner(p_stall_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stalls s
    where s.id = p_stall_id and s.owner_id = (select auth.uid())
  );
$$;
revoke all on function public.is_stall_owner(uuid) from public, anon;
grant execute on function public.is_stall_owner(uuid) to authenticated;

create policy "Exhibitors can read analytics for their stalls"
  on public.track_events for select to authenticated
  using (public.is_stall_owner(stall_id));

revoke all on public.events, public.zones, public.stalls, public.profiles,
  public.event_progress, public.checkins, public.rewards, public.claims,
  public.track_events, public.checkin_attempts from anon, authenticated;

grant select on public.events, public.zones to anon, authenticated;
grant select (
  id, event_id, zone_id, stall_number, title, category, description,
  whatsapp_number, map_x, map_y, checkin_coins, price_range, is_featured, media, products
) on public.stalls to anon, authenticated;
grant select on public.profiles, public.event_progress, public.checkins,
  public.rewards, public.claims, public.track_events to authenticated;

create view public.stalls_public
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
  s.products
from public.stalls s
join public.events e on e.id = s.event_id
left join public.zones z on z.id = s.zone_id;
grant select on public.stalls_public to anon, authenticated;

create view public.leaderboard
with (security_barrier = true)
as
select
  p.username,
  ep.event_id,
  ep.stalls_visited,
  ep.coins,
  rank() over (
    partition by ep.event_id
    order by ep.stalls_visited desc, ep.coins desc
  ) as rank
from public.event_progress ep
join public.profiles p on p.id = ep.profile_id
join public.events e on e.id = ep.event_id
where e.is_published;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.handle_new_visitor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'Explorer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_visitor();
revoke all on function public.handle_new_visitor() from public, anon, authenticated;

create or replace function public.checkin_stall(
  p_stall_id uuid,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_event_id uuid;
  v_zone_id uuid;
  v_coins int;
  v_checkin_id uuid;
  v_stalls_visited int;
  v_total_stalls int;
  v_zone_visited int;
  v_voucher_available boolean;
begin
  if v_profile_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_IP_HASH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_profile_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ip:' || p_ip_hash, 0));

  delete from public.checkin_attempts a
  where (a.profile_id = v_profile_id or a.ip_hash = p_ip_hash)
    and a.created_at < now() - interval '1 day';

  if (
    select count(*) from public.checkin_attempts a
    where a.profile_id = v_profile_id and a.created_at > now() - interval '10 minutes'
  ) >= 10 or (
    select count(*) from public.checkin_attempts a
    where a.ip_hash = p_ip_hash and a.created_at > now() - interval '10 minutes'
  ) >= 30 then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'RATE_LIMITED');
  end if;

  insert into public.checkin_attempts (profile_id, ip_hash)
  values (v_profile_id, p_ip_hash);

  select s.event_id, s.zone_id, s.checkin_coins
  into v_event_id, v_zone_id, v_coins
  from public.stalls s
  join public.events e on e.id = s.event_id
  where s.id = p_stall_id
    and e.is_published
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at >= now());

  if v_event_id is null then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'STALL_NOT_AVAILABLE');
  end if;

  insert into public.checkins (profile_id, stall_id, event_id)
  values (v_profile_id, p_stall_id, v_event_id)
  on conflict (profile_id, stall_id) do nothing
  returning id into v_checkin_id;

  if v_checkin_id is null then
    return pg_catalog.jsonb_build_object('success', false, 'error', 'CHECKIN_ALREADY_RECORDED');
  end if;

  insert into public.event_progress (profile_id, event_id, coins, stalls_visited)
  values (v_profile_id, v_event_id, v_coins, 1)
  on conflict (profile_id, event_id) do update
  set coins = public.event_progress.coins + excluded.coins,
      stalls_visited = public.event_progress.stalls_visited + 1,
      updated_at = now()
  returning stalls_visited into v_stalls_visited;

  insert into public.track_events (event_id, stall_id, profile_id, kind)
  values (v_event_id, p_stall_id, v_profile_id, 'checkin');

  if v_zone_id is not null then
    select count(*)::int into v_total_stalls
    from public.stalls s where s.zone_id = v_zone_id;

    select count(*)::int into v_zone_visited
    from public.checkins c where c.profile_id = v_profile_id and c.event_id = v_event_id
      and exists (select 1 from public.stalls s where s.id = c.stall_id and s.zone_id = v_zone_id);
  end if;

  select exists (
    select 1
    from public.rewards r
    where r.stall_id = p_stall_id
      and r.kind in ('voucher', 'prize')
      and r.is_active
      and r.claims_count < r.claim_limit
      and (not r.requires_verified_phone or exists (
        select 1 from public.profiles p
        where p.id = v_profile_id and p.phone_verified
      ))
  ) into v_voucher_available;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'checkinId', v_checkin_id,
    'coinsAwarded', v_coins,
    'stallsVisited', v_stalls_visited,
    'zoneProgress', case when v_zone_id is null then null else pg_catalog.jsonb_build_object(
      'zoneId', v_zone_id,
      'visited', v_zone_visited,
      'total', v_total_stalls,
      'percentage', case when v_total_stalls = 0 then 0 else round(v_zone_visited::numeric * 100 / v_total_stalls)::int end
    ) end,
    'voucherAvailable', coalesce(v_voucher_available, false)
  );
end;
$$;
revoke all on function public.checkin_stall(uuid, text) from public, anon;
grant execute on function public.checkin_stall(uuid, text) to authenticated;
