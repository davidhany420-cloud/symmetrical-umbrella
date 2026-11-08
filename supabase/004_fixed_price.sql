-- =====================================================================
--  في السكة · تحديث 4 — سعر ثابت بالكيلو (3 جنيه للكيلو) ومفيش فصال
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

alter table public.bookings add column if not exists distance_km numeric(7, 2);

-- straight-line distance in km between two points
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- The app measures the road distance; the server checks it is plausible
-- (at least the straight line, at most 3x it) and that price = distance × 3 EGP.
drop function if exists public.create_booking(uuid, text, text, text, text, int[], text, int, double precision, double precision, double precision, double precision);
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
  c_per_km constant int := 3;
begin
  select * into v_client from public.profiles where id = auth.uid() and role = 'client';
  if v_client.id is null then raise exception 'rider account required'; end if;

  select p.gender into v_cap_gender from public.captains c join public.profiles p on p.id = c.user_id
  where c.user_id = p_captain and c.status = 'approved' and c.active_until > now();
  if v_cap_gender is null or v_cap_gender <> v_client.gender then raise exception 'captain not available'; end if;

  if p_from_lat is null or p_to_lat is null or p_distance_km is null then raise exception 'pickup and destination required'; end if;
  v_line := public.km_between(p_from_lat, p_from_lng, p_to_lat, p_to_lng);
  if p_distance_km < v_line * 0.95 or p_distance_km > greatest(v_line * 3, v_line + 2) then raise exception 'distance mismatch'; end if;

  -- one ride, or one ride per chosen day for 4 weeks
  v_trips := case when p_type = 'monthly' then greatest(coalesce(array_length(p_days, 1), 0), 1) * 4 else 1 end;
  v_price := greatest(ceil(p_distance_km * c_per_km)::int, 1) * v_trips;
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

-- no haggling: the captain can only accept or decline
create or replace function public.captain_respond(p_booking uuid, p_action text, p_counter int default null) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_name text;
begin
  if p_action not in ('accept', 'reject') then raise exception 'price is fixed'; end if;
  select * into b from public.bookings where id = p_booking and captain_id = auth.uid() and status = 'pending' for update;
  if b.id is null then raise exception 'request not found'; end if;
  select name into v_name from public.profiles where id = auth.uid();
  if p_action = 'accept' then
    update public.bookings set status = 'accepted', price = offer where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' قبل المشوار 🎉');
    perform public.notify_user(b.client_id, v_name || ' قبل طلبك');
  else
    update public.bookings set status = 'rejected' where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' اعتذر عن الطلب');
    perform public.notify_user(b.client_id, v_name || ' اعتذر — اختار كابتن تاني');
  end if;
end $$;

select 'تمام ✅ السعر بقى 3 جنيه للكيلو ومفيش فصال' as result;
