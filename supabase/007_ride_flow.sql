-- =====================================================================
--  في السكة · تحديث 7 — مراحل المشوار، انتهاء الطلب، تقييم الراكب، حذف الحساب
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- ---------- new columns ----------
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'countered', 'accepted', 'rejected', 'cancelled', 'done', 'expired'));
alter table public.bookings add column if not exists stage text;
alter table public.bookings drop constraint if exists bookings_stage_check;
alter table public.bookings add constraint bookings_stage_check check (stage is null or stage in ('arrived', 'started'));
alter table public.bookings add column if not exists rider_rating int;
alter table public.bookings drop constraint if exists bookings_rider_rating_check;
alter table public.bookings add constraint bookings_rider_rating_check check (rider_rating is null or rider_rating between 1 and 5);
alter table public.bookings add column if not exists finished_at timestamptz;

alter table public.profiles add column if not exists rider_rating numeric(2, 1) not null default 5;
alter table public.profiles add column if not exists rider_rating_count int not null default 0;
alter table public.profiles add column if not exists deleted_at timestamptz;
grant select (rider_rating, rider_rating_count, deleted_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 1) A request waits 2 minutes for the captain, then expires.
-- ---------------------------------------------------------------------
create or replace function public.expire_request(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  update public.bookings set status = 'expired'
  where id = p_booking and status = 'pending' and created_at < now() - interval '2 minutes'
    and (client_id = auth.uid() or captain_id = auth.uid())
  returning * into b;
  if b.id is null then return; end if;
  insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'الكابتن ما ردّش في الوقت — الطلب انتهى');
  perform public.notify_user(b.captain_id, 'طلب انتهى قبل ما ترد عليه: ' || b.from_place || ' ← ' || b.to_place);
end $$;

-- captains can't accept an expired request
create or replace function public.captain_respond(p_booking uuid, p_action text, p_counter int default null) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_name text;
begin
  if p_action not in ('accept', 'reject') then raise exception 'price is fixed'; end if;
  select * into b from public.bookings where id = p_booking and captain_id = auth.uid() and status = 'pending' for update;
  if b.id is null then raise exception 'request not found'; end if;
  if b.created_at < now() - interval '2 minutes' then
    update public.bookings set status = 'expired' where id = p_booking;
    raise exception 'request expired';
  end if;
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

-- the "2 waiting requests" limit only counts requests that haven't expired
create or replace function public.limit_pending_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set status = 'expired'
  where client_id = new.client_id and status = 'pending' and created_at < now() - interval '2 minutes';
  if (select count(*) from public.bookings where client_id = new.client_id and status = 'pending') >= 2 then
    raise exception 'too many pending requests';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2) Ride stages, driven by the captain: arrived → started → finished.
-- ---------------------------------------------------------------------
create or replace function public.captain_stage(p_booking uuid, p_stage text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_name text;
begin
  select * into b from public.bookings where id = p_booking and captain_id = auth.uid() and status = 'accepted' for update;
  if b.id is null then raise exception 'not found'; end if;
  select name into v_name from public.profiles where id = auth.uid();
  if p_stage = 'arrived' and b.stage is null then
    update public.bookings set stage = 'arrived' where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' وصل لمكانك 📍');
    perform public.notify_user(b.client_id, v_name || ' وصل لمكانك — انزل له');
  elsif p_stage = 'started' and (b.stage is null or b.stage = 'arrived') then
    update public.bookings set stage = 'started' where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'المشوار بدأ 🏍️');
  elsif p_stage = 'finished' and b.stage = 'started' then
    update public.bookings set status = 'done', finished_at = now() where id = p_booking;
    update public.captains set trips = trips + 1 where user_id = auth.uid();
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'وصلتوا بالسلامة 🎉');
    perform public.notify_user(b.client_id, 'وصلت بالسلامة؟ قيّم ' || v_name);
  else
    raise exception 'wrong stage';
  end if;
end $$;

-- rider rates the captain after the captain finished the ride
create or replace function public.rate_captain(p_booking uuid, p_rating int) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  update public.bookings set rating = p_rating
  where id = p_booking and client_id = auth.uid() and status = 'done' and rating is null
  returning * into b;
  if b.id is null then raise exception 'not found'; end if;
  update public.captains set
    rating = round((rating * rating_count + p_rating)::numeric / (rating_count + 1), 1),
    rating_count = rating_count + 1
  where user_id = b.captain_id;
end $$;

-- ---------------------------------------------------------------------
-- 3) Captain rates the rider.
-- ---------------------------------------------------------------------
create or replace function public.rate_rider(p_booking uuid, p_rating int) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  update public.bookings set rider_rating = p_rating
  where id = p_booking and captain_id = auth.uid() and status = 'done' and rider_rating is null
  returning * into b;
  if b.id is null then raise exception 'not found'; end if;
  update public.profiles set
    rider_rating = round((rider_rating * rider_rating_count + p_rating)::numeric / (rider_rating_count + 1), 1),
    rider_rating_count = rider_rating_count + 1
  where id = b.client_id;
end $$;

-- ---------------------------------------------------------------------
-- 4) Delete my account. The account is closed right away; the data is kept
--    180 days (Law 87/2018 requires ride data to be retained) and then
--    removed by the admin.
-- ---------------------------------------------------------------------
create or replace function public.request_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  update public.profiles set deleted_at = now() where id = auth.uid() and deleted_at is null returning name into v_name;
  if v_name is null then return; end if;
  update public.captains set online = false, status = case when status = 'approved' then 'suspended' else status end,
    reject_reason = 'الحساب اتقفل بطلب صاحبه'
  where user_id = auth.uid();
  delete from public.captain_live where captain_id = auth.uid();
  update public.bookings set status = 'cancelled'
  where (client_id = auth.uid() or captain_id = auth.uid()) and status in ('pending', 'countered', 'accepted');
  perform public.notify_admin('طلب حذف حساب: ' || v_name);
end $$;

-- closed accounts don't show up as available captains
create or replace function public.nearby_captains(p_lat double precision, p_lng double precision, p_radius_km double precision default 20)
returns table (captain_id uuid, distance_km numeric)
language sql stable security definer set search_path = public as $$
  select l.captain_id, round(public.km_between(p_lat, p_lng, l.lat, l.lng)::numeric, 1)
  from public.captain_live l
  join public.captains c on c.user_id = l.captain_id
  join public.profiles cp on cp.id = c.user_id
  join public.profiles me on me.id = auth.uid() and me.role = 'client'
  where c.status = 'approved' and c.online and c.active_until > now()
    and cp.deleted_at is null
    and cp.gender = me.gender
    and l.updated_at > now() - interval '3 minutes'
    and public.km_between(p_lat, p_lng, l.lat, l.lng) <= least(p_radius_km, 20)
  order by 2
  limit 30;
$$;

select 'تمام ✅ مراحل المشوار وانتهاء الطلب والتقييم وحذف الحساب جاهزين' as result;
