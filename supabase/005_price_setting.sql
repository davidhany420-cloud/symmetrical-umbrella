-- =====================================================================
--  في السكة · تحديث 5 — سعر الكيلو 4.5 جنيه (ويتغيّر بعد كده من لوحة الإدارة)
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- app-wide settings (readable by everyone, changed by the admin only)
create table if not exists public.app_settings (
  key         text primary key,
  value       numeric not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);

insert into public.app_settings (key, value) values ('price_per_km', 4.5)
on conflict (key) do update set value = 4.5, updated_at = now();

create or replace function public.price_per_km() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = 'price_per_km'), 4.5);
$$;

-- admin: change the price from the admin panel
create or replace function public.admin_set_price_per_km(p_price numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_price <= 0 or p_price > 100 then raise exception 'bad price'; end if;
  insert into public.app_settings (key, value) values ('price_per_km', p_price)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- booking price = road distance × price per km (rounded up to a whole pound)
create or replace function public.create_booking(
  p_captain uuid, p_type text, p_from text, p_to text, p_time text, p_days int[], p_bike_class text, p_offer int,
  p_from_lat double precision default null, p_from_lng double precision default null,
  p_to_lat double precision default null, p_to_lng double precision default null,
  p_distance_km double precision default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_client public.profiles; v_cap_gender text; v_id uuid;
  v_line double precision; v_trips int; v_price int;
  v_per_km numeric := public.price_per_km();
begin
  select * into v_client from public.profiles where id = auth.uid() and role = 'client';
  if v_client.id is null then raise exception 'rider account required'; end if;

  select p.gender into v_cap_gender from public.captains c join public.profiles p on p.id = c.user_id
  where c.user_id = p_captain and c.status = 'approved' and c.active_until > now();
  if v_cap_gender is null or v_cap_gender <> v_client.gender then raise exception 'captain not available'; end if;

  if p_from_lat is null or p_to_lat is null or p_distance_km is null then raise exception 'pickup and destination required'; end if;
  v_line := public.km_between(p_from_lat, p_from_lng, p_to_lat, p_to_lng);
  if p_distance_km < v_line * 0.95 or p_distance_km > greatest(v_line * 3, v_line + 2) then raise exception 'distance mismatch'; end if;

  v_trips := case when p_type = 'monthly' then greatest(coalesce(array_length(p_days, 1), 0), 1) * 4 else 1 end;
  v_price := greatest(ceil(p_distance_km::numeric * v_per_km)::int, 1) * v_trips;
  if p_offer <> v_price then raise exception 'price mismatch'; end if;

  insert into public.bookings (client_id, captain_id, mode, type, from_place, to_place, time, days, bike_class, offer, from_lat, from_lng, to_lat, to_lng, distance_km)
  values (auth.uid(), p_captain, case when v_client.gender = 'female' then 'girls' else 'boys' end,
          p_type, p_from, p_to, p_time, coalesce(p_days, '{}'), p_bike_class, v_price, p_from_lat, p_from_lng, p_to_lat, p_to_lng, round(p_distance_km::numeric, 2))
  returning id into v_id;
  insert into public.messages (booking_id, sender, text)
  values (v_id, 'system', 'اتبعت الطلب للكابتن — ' || round(p_distance_km::numeric, 1) || ' كم · ' || v_price || ' ج');
  perform public.notify_user(p_captain, 'طلب ' || case when p_type = 'monthly' then 'اشتراك شهري' else 'مشوار' end || ' جديد: ' || p_from || ' ← ' || p_to || ' (' || v_price || ' ج)');
  return v_id;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;

select 'تمام ✅ سعر الكيلو بقى ' || public.price_per_km() || ' جنيه' as result;
