create table public.vendor_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  contact_email text not null,
  whatsapp text not null,
  website_url text,
  stall_number text not null,
  category text not null check (category in ('Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech', 'Other')),
  description text not null,
  zone_id uuid not null references public.zones(id) on delete restrict,
  map_x int not null check (map_x between 0 and 960),
  map_y int not null check (map_y between 0 and 700),
  photo_paths text[] not null default '{}',
  photo_consent boolean not null default false,
  gift_title text,
  gift_details text,
  gift_quantity int check (gift_quantity between 1 and 10000),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'needs_changes', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (gift_title is null and gift_details is null and gift_quantity is null)
    or (gift_title is not null and gift_details is not null and gift_quantity is not null)
  ),
  check (photo_consent or cardinality(photo_paths) = 0)
);

create index vendor_applications_review_idx
  on public.vendor_applications (status, created_at);
alter table public.vendor_applications enable row level security;
revoke all on public.vendor_applications from anon, authenticated;
grant all on public.vendor_applications to service_role;

create table public.vendor_application_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  submissions int not null check (submissions > 0)
);
alter table public.vendor_application_rate_limits enable row level security;
revoke all on public.vendor_application_rate_limits from anon, authenticated;
grant all on public.vendor_application_rate_limits to service_role;

create or replace function public.reserve_vendor_application_submission(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submissions int;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_KEY';
  end if;

  insert into public.vendor_application_rate_limits as limits (ip_hash, window_started_at, submissions)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set window_started_at = case
        when limits.window_started_at <= now() - interval '1 hour' then now()
        else limits.window_started_at
      end,
      submissions = case
        when limits.window_started_at <= now() - interval '1 hour' then 1
        else limits.submissions + 1
      end
  returning submissions into v_submissions;

  return v_submissions <= 3;
end;
$$;
revoke all on function public.reserve_vendor_application_submission(text) from public, anon, authenticated;
grant execute on function public.reserve_vendor_application_submission(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-application-photos',
  'vendor-application-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
