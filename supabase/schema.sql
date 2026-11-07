-- =====================================================================
--  في السكة · Fel Sekka — قاعدة البيانات
--  الصق الملف ده كله في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        text not null check (role in ('client', 'captain')),
  name        text not null check (char_length(name) between 2 and 60),
  phone       text not null unique check (phone ~ '^01[0125][0-9]{8}$'),
  gender      text not null check (gender in ('male', 'female')),
  created_at  timestamptz not null default now()
);

create table if not exists public.admins (
  user_id     uuid primary key references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.captains (
  user_id       uuid primary key references public.profiles on delete cascade,
  bike_class    text not null check (bike_class in ('scooter', 'classic', 'electric', 'sport')),
  bike_model    text not null check (char_length(bike_model) between 2 and 60),
  plate         text not null check (char_length(plate) between 3 and 20),
  governorate   text not null,
  photo_path    text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reject_reason text,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  active_until  timestamptz,
  rating        numeric(2, 1) not null default 5,
  rating_count  int not null default 0,
  trips         int not null default 0,
  online        boolean not null default false
);

-- sensitive captain data: only the captain and admins can read it
create table if not exists public.captain_private (
  user_id       uuid primary key references public.captains on delete cascade,
  national_id   text not null check (national_id ~ '^[0-9]{14}$'),
  id_path       text,
  license_path  text,
  bike_path     text
);

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  captain_id    uuid not null references public.captains on delete cascade,
  ref           text not null check (char_length(ref) between 6 and 40),
  receipt_path  text,
  amount        int not null default 200,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
create unique index if not exists payments_one_pending on public.payments (captain_id) where status = 'pending';

create table if not exists public.lines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  governorate text not null,
  from_place  text not null,
  to_place    text not null,
  time        text not null,
  price       int not null check (price > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles on delete cascade,
  captain_id  uuid not null references public.captains on delete cascade,
  mode        text not null check (mode in ('boys', 'girls')),
  type        text not null check (type in ('monthly', 'once')),
  from_place  text not null check (char_length(from_place) between 2 and 120),
  to_place    text not null check (char_length(to_place) between 2 and 120),
  time        text not null,
  days        int[] not null default '{}',
  bike_class  text not null,
  offer       int not null check (offer > 0),
  counter     int,
  price       int,
  status      text not null default 'pending' check (status in ('pending', 'countered', 'accepted', 'rejected', 'cancelled', 'done')),
  rating      int check (rating between 1 and 5),
  created_at  timestamptz not null default now()
);
create index if not exists bookings_client on public.bookings (client_id, created_at desc);
create index if not exists bookings_captain on public.bookings (captain_id, created_at desc);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings on delete cascade,
  sender      text not null check (sender in ('client', 'captain', 'system')),
  text        text not null check (char_length(text) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_booking on public.messages (booking_id, id);

create table if not exists public.notices (
  id          bigint generated always as identity primary key,
  to_user     uuid references auth.users on delete cascade,
  to_admin    boolean not null default false,
  text        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notices_user on public.notices (to_user, id desc);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.notify_user(p_user uuid, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into public.notices (to_user, text) values (p_user, p_text);
$$;

create or replace function public.notify_admin(p_text text) returns void
language sql security definer set search_path = public as $$
  insert into public.notices (to_admin, text) values (true, p_text);
$$;
revoke execute on function public.notify_user(uuid, text) from public, anon, authenticated;
revoke execute on function public.notify_admin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.admins          enable row level security;
alter table public.captains        enable row level security;
alter table public.captain_private enable row level security;
alter table public.payments        enable row level security;
alter table public.lines           enable row level security;
alter table public.bookings        enable row level security;
alter table public.messages        enable row level security;
alter table public.notices         enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or role = 'captain'
  or exists (select 1 from public.bookings b where b.captain_id = auth.uid() and b.client_id = profiles.id)
);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists captains_read on public.captains;
create policy captains_read on public.captains for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or status = 'approved'
);

drop policy if exists captain_private_read on public.captain_private;
create policy captain_private_read on public.captain_private for select to authenticated using (
  user_id = auth.uid() or public.is_admin()
);

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
  captain_id = auth.uid() or public.is_admin()
);

drop policy if exists lines_read on public.lines;
create policy lines_read on public.lines for select to anon, authenticated using (active or public.is_admin());
drop policy if exists lines_admin on public.lines;
create policy lines_admin on public.lines for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated using (
  client_id = auth.uid() or captain_id = auth.uid() or public.is_admin()
);

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and (b.client_id = auth.uid() or b.captain_id = auth.uid())
  )
);

drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select to authenticated using (
  to_user = auth.uid() or (to_admin and public.is_admin())
);

-- ---------------------------------------------------------------------
-- Actions (all writes go through these, so the rules live on the server)
-- ---------------------------------------------------------------------

-- first account to call this becomes the admin; afterwards nobody can
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.admins) then
    return exists (select 1 from public.admins where user_id = auth.uid());
  end if;
  insert into public.admins (user_id) values (auth.uid());
  return true;
end $$;

create or replace function public.admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins);
$$;

create or replace function public.submit_application(
  p_bike_class text, p_bike_model text, p_plate text, p_governorate text, p_national_id text,
  p_photo_path text, p_id_path text, p_license_path text, p_bike_path text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.profiles where id = auth.uid() and role = 'captain';
  if v_name is null then raise exception 'captain account required'; end if;
  if exists (select 1 from public.captains where user_id = auth.uid() and status in ('approved', 'suspended')) then
    raise exception 'already reviewed';
  end if;
  insert into public.captains (user_id, bike_class, bike_model, plate, governorate, photo_path, status, submitted_at, reject_reason, reviewed_at)
  values (auth.uid(), p_bike_class, p_bike_model, p_plate, p_governorate, p_photo_path, 'pending', now(), null, null)
  on conflict (user_id) do update set
    bike_class = excluded.bike_class, bike_model = excluded.bike_model, plate = excluded.plate,
    governorate = excluded.governorate, photo_path = excluded.photo_path,
    status = 'pending', submitted_at = now(), reject_reason = null, reviewed_at = null;
  insert into public.captain_private (user_id, national_id, id_path, license_path, bike_path)
  values (auth.uid(), p_national_id, p_id_path, p_license_path, p_bike_path)
  on conflict (user_id) do update set
    national_id = excluded.national_id, id_path = excluded.id_path,
    license_path = excluded.license_path, bike_path = excluded.bike_path;
  perform public.notify_admin('طلب انضمام كابتن جديد: ' || v_name);
end $$;

create or replace function public.set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.captains set online = p_online
  where user_id = auth.uid() and (not p_online or (status = 'approved' and active_until > now()));
end $$;

create or replace function public.submit_payment(p_ref text, p_receipt_path text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select p.name into v_name from public.profiles p join public.captains c on c.user_id = p.id
  where p.id = auth.uid() and c.status = 'approved';
  if v_name is null then raise exception 'approved captain required'; end if;
  insert into public.payments (captain_id, ref, receipt_path) values (auth.uid(), p_ref, p_receipt_path);
  perform public.notify_admin('دفعة InstaPay جديدة من ' || v_name || ' — مرجع ' || p_ref);
end $$;

create or replace function public.admin_review_captain(p_user uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.captains set
    status = case when p_approve then 'approved' else 'rejected' end,
    reject_reason = case when p_approve then null else p_reason end,
    reviewed_at = now()
  where user_id = p_user and status = 'pending';
  if not found then raise exception 'application not pending'; end if;
  perform public.notify_user(p_user, case when p_approve
    then 'مبروك! حسابك اتقبل ✨ فعّل الاشتراك وابدأ تستقبل مشاوير'
    else 'طلبك اترفض: ' || coalesce(nullif(p_reason, ''), 'راجع بياناتك') end);
end $$;

create or replace function public.admin_suspend_captain(p_user uuid, p_suspend boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.captains set
    status = case when p_suspend then 'suspended' else 'approved' end,
    online = case when p_suspend then false else online end,
    reject_reason = case when p_suspend then p_reason else null end,
    reviewed_at = now()
  where user_id = p_user and status in ('approved', 'suspended');
  perform public.notify_user(p_user, case when p_suspend
    then 'حسابك اتوقف مؤقتاً: ' || coalesce(nullif(p_reason, ''), 'تواصل مع الدعم')
    else 'حسابك اتفعّل تاني ✅' end);
end $$;

create or replace function public.admin_review_payment(p_payment uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_captain uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.payments set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
  where id = p_payment and status = 'pending' returning captain_id into v_captain;
  if v_captain is null then raise exception 'payment not pending'; end if;
  if p_approve then
    update public.captains set active_until = greatest(now(), coalesce(active_until, now())) + interval '365 days'
    where user_id = v_captain;
  end if;
  perform public.notify_user(v_captain, case when p_approve
    then 'اتأكدنا من الدفع — اشتراكك شغال سنة كاملة ✅'
    else 'مش لاقيين التحويل ده — راجع رقم المرجع وابعته تاني' end);
end $$;

create or replace function public.create_booking(
  p_captain uuid, p_type text, p_from text, p_to text, p_time text, p_days int[], p_bike_class text, p_offer int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_client public.profiles; v_cap_gender text; v_id uuid;
begin
  select * into v_client from public.profiles where id = auth.uid() and role = 'client';
  if v_client.id is null then raise exception 'rider account required'; end if;
  select p.gender into v_cap_gender from public.captains c join public.profiles p on p.id = c.user_id
  where c.user_id = p_captain and c.status = 'approved' and c.active_until > now() and c.bike_class = p_bike_class;
  if v_cap_gender is null then raise exception 'captain not available'; end if;
  if v_cap_gender <> v_client.gender then raise exception 'captain not available'; end if;
  insert into public.bookings (client_id, captain_id, mode, type, from_place, to_place, time, days, bike_class, offer)
  values (auth.uid(), p_captain, case when v_client.gender = 'female' then 'girls' else 'boys' end,
          p_type, p_from, p_to, p_time, coalesce(p_days, '{}'), p_bike_class, p_offer)
  returning id into v_id;
  insert into public.messages (booking_id, sender, text) values (v_id, 'system', 'اتبعت عرضك ' || p_offer || ' ج للكابتن');
  perform public.notify_user(p_captain, 'طلب ' || case when p_type = 'monthly' then 'اشتراك شهري' else 'مشوار' end || ' جديد: ' || p_from || ' ← ' || p_to);
  return v_id;
end $$;

create or replace function public.captain_respond(p_booking uuid, p_action text, p_counter int default null) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_name text;
begin
  select * into b from public.bookings where id = p_booking and captain_id = auth.uid() and status = 'pending' for update;
  if b.id is null then raise exception 'request not found'; end if;
  select name into v_name from public.profiles where id = auth.uid();
  if p_action = 'accept' then
    update public.bookings set status = 'accepted', price = offer where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' وافق على ' || b.offer || ' ج 🎉');
    perform public.notify_user(b.client_id, v_name || ' وافق على طلبك');
  elsif p_action = 'reject' then
    update public.bookings set status = 'rejected' where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' اعتذر عن الطلب');
    perform public.notify_user(b.client_id, v_name || ' اعتذر — اختار كابتن تاني');
  elsif p_action = 'counter' and p_counter > 0 then
    update public.bookings set status = 'countered', counter = p_counter where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', v_name || ' اقترح ' || p_counter || ' ج');
    perform public.notify_user(b.client_id, v_name || ' اقترح سعر ' || p_counter || ' ج');
  else
    raise exception 'bad action';
  end if;
end $$;

create or replace function public.client_answer_counter(p_booking uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and client_id = auth.uid() and status = 'countered' for update;
  if b.id is null then raise exception 'not found'; end if;
  if p_accept then
    update public.bookings set status = 'accepted', price = counter where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'اتفقتوا على ' || b.counter || ' ج 🎉');
    perform public.notify_user(b.captain_id, 'العميل وافق على سعرك');
  else
    update public.bookings set status = 'cancelled' where id = p_booking;
    insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'العميل رفض السعر');
    perform public.notify_user(b.captain_id, 'العميل رفض السعر المقترح');
  end if;
end $$;

create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  update public.bookings set status = 'cancelled'
  where id = p_booking and client_id = auth.uid() and status in ('pending', 'countered', 'accepted')
  returning * into b;
  if b.id is null then raise exception 'not found'; end if;
  insert into public.messages (booking_id, sender, text) values (p_booking, 'system', 'الطلب اتلغى');
  perform public.notify_user(b.captain_id, 'الراكب لغى الطلب: ' || b.from_place || ' ← ' || b.to_place);
end $$;

create or replace function public.complete_booking(p_booking uuid, p_rating int) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if p_rating not between 1 and 5 then raise exception 'bad rating'; end if;
  update public.bookings set status = 'done', rating = p_rating
  where id = p_booking and client_id = auth.uid() and status = 'accepted'
  returning * into b;
  if b.id is null then raise exception 'not found'; end if;
  update public.captains set
    trips = trips + 1,
    rating = round((rating * rating_count + p_rating)::numeric / (rating_count + 1), 1),
    rating_count = rating_count + 1
  where user_id = b.captain_id;
end $$;

create or replace function public.send_message(p_booking uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; v_sender text;
begin
  select * into b from public.bookings where id = p_booking;
  if b.client_id = auth.uid() then v_sender := 'client';
  elsif b.captain_id = auth.uid() then v_sender := 'captain';
  else raise exception 'not allowed'; end if;
  insert into public.messages (booking_id, sender, text) values (p_booking, v_sender, left(trim(p_text), 1000));
end $$;

create or replace function public.mark_notices_read() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.notices set read = true where to_user = auth.uid() and not read;
  if public.is_admin() then update public.notices set read = true where to_admin and not read; end if;
end $$;

-- ---------------------------------------------------------------------
-- Document storage (private bucket: id cards, licenses, receipts)
-- files live under  <user id>/<name>.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists documents_upload on storage.objects;
create policy documents_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects for update to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or storage.filename(name) like 'photo%'   -- captain profile photos are visible to riders
  )
);

-- ---------------------------------------------------------------------
-- Live updates (the admin panel and apps refresh instantly)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'captains', 'payments', 'bookings', 'messages', 'notices', 'lines'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Starter fixed lines (edit them later from the admin panel)
-- ---------------------------------------------------------------------
insert into public.lines (name, governorate, from_place, to_place, time, price)
select * from (values
  ('المعادي ⟵ التجمع', 'القاهرة', 'المعادي – دجلة', 'التجمع الخامس – التسعين', '07:30', 1300),
  ('فيصل ⟵ جامعة القاهرة', 'الجيزة', 'فيصل – المطبعة', 'جامعة القاهرة', '08:00', 1000),
  ('مدينة نصر ⟵ وسط البلد', 'القاهرة', 'مدينة نصر – عباس العقاد', 'وسط البلد – التحرير', '08:30', 1150),
  ('سموحة ⟵ محطة الرمل', 'الإسكندرية', 'سموحة', 'محطة الرمل', '08:00', 950)
) v
where not exists (select 1 from public.lines);

select 'تمام ✅ قاعدة بيانات في السكة جاهزة' as result;
