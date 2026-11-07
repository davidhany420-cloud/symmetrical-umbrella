-- =====================================================================
--  في السكة · تحديث 2 — الخريطة والـ GPS المباشر
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- pickup / drop-off coordinates on each booking
alter table public.bookings add column if not exists from_lat double precision;
alter table public.bookings add column if not exists from_lng double precision;
alter table public.bookings add column if not exists to_lat   double precision;
alter table public.bookings add column if not exists to_lng   double precision;

-- the captain's last known position while sharing location
create table if not exists public.captain_live (
  captain_id  uuid primary key references public.captains on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  heading     double precision,
  speed       double precision,
  updated_at  timestamptz not null default now()
);
alter table public.captain_live enable row level security;

-- visible to: the captain, admins, and riders with an active (accepted) ride with that captain
drop policy if exists captain_live_read on public.captain_live;
create policy captain_live_read on public.captain_live for select to authenticated using (
  captain_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.bookings b
    where b.captain_id = captain_live.captain_id and b.client_id = auth.uid() and b.status = 'accepted'
  )
);

create or replace function public.update_location(p_lat double precision, p_lng double precision, p_heading double precision default null, p_speed double precision default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.captains where user_id = auth.uid() and status = 'approved') then
    raise exception 'approved captain required';
  end if;
  insert into public.captain_live (captain_id, lat, lng, heading, speed, updated_at)
  values (auth.uid(), p_lat, p_lng, p_heading, p_speed, now())
  on conflict (captain_id) do update set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading, speed = excluded.speed, updated_at = now();
end $$;

create or replace function public.stop_location() returns void
language sql security definer set search_path = public as $$
  delete from public.captain_live where captain_id = auth.uid();
$$;

-- create_booking now also takes the map coordinates
drop function if exists public.create_booking(uuid, text, text, text, text, int[], text, int);
create or replace function public.create_booking(
  p_captain uuid, p_type text, p_from text, p_to text, p_time text, p_days int[], p_bike_class text, p_offer int,
  p_from_lat double precision default null, p_from_lng double precision default null,
  p_to_lat double precision default null, p_to_lng double precision default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_client public.profiles; v_cap_gender text; v_id uuid;
begin
  select * into v_client from public.profiles where id = auth.uid() and role = 'client';
  if v_client.id is null then raise exception 'rider account required'; end if;
  select p.gender into v_cap_gender from public.captains c join public.profiles p on p.id = c.user_id
  where c.user_id = p_captain and c.status = 'approved' and c.active_until > now() and c.bike_class = p_bike_class;
  if v_cap_gender is null or v_cap_gender <> v_client.gender then raise exception 'captain not available'; end if;
  insert into public.bookings (client_id, captain_id, mode, type, from_place, to_place, time, days, bike_class, offer, from_lat, from_lng, to_lat, to_lng)
  values (auth.uid(), p_captain, case when v_client.gender = 'female' then 'girls' else 'boys' end,
          p_type, p_from, p_to, p_time, coalesce(p_days, '{}'), p_bike_class, p_offer, p_from_lat, p_from_lng, p_to_lat, p_to_lng)
  returning id into v_id;
  insert into public.messages (booking_id, sender, text) values (v_id, 'system', 'اتبعت عرضك ' || p_offer || ' ج للكابتن');
  perform public.notify_user(p_captain, 'طلب ' || case when p_type = 'monthly' then 'اشتراك شهري' else 'مشوار' end || ' جديد: ' || p_from || ' ← ' || p_to);
  return v_id;
end $$;

-- live updates for positions
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'captain_live') then
    alter publication supabase_realtime add table public.captain_live;
  end if;
end $$;

select 'تمام ✅ الخريطة والـ GPS جاهزين' as result;
