-- =====================================================================
--  في السكة · تحديث 6 — مراجعة أمان
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Phone numbers are private.
--    Nobody can read the phone column directly any more; each person gets
--    only the numbers they need through visible_phones():
--    their own, the other side of an accepted/finished ride, or all (admin).
-- ---------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (id, role, name, gender, created_at) on public.profiles to authenticated;

create or replace function public.visible_phones()
returns table (id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.phone from public.profiles p
  where p.id = auth.uid()
     or public.is_admin()
     or exists (
       select 1 from public.bookings b
       where b.status in ('accepted', 'done')
         and ((b.client_id = auth.uid() and b.captain_id = p.id) or (b.captain_id = auth.uid() and b.client_id = p.id))
     );
$$;
revoke execute on function public.visible_phones() from anon;

-- riders see names of approved captains only (not people still applying)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.captains c where c.user_id = profiles.id and c.status = 'approved')
  or exists (select 1 from public.bookings b where b.captain_id = auth.uid() and b.client_id = profiles.id)
);

-- ---------------------------------------------------------------------
-- 2) Captains' exact live position is no longer readable by everyone.
--    Riders get only "who is near me and how far" from nearby_captains();
--    the exact position is visible only during an accepted ride.
-- ---------------------------------------------------------------------
drop policy if exists captain_live_read on public.captain_live;
create policy captain_live_read on public.captain_live for select to authenticated using (
  captain_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings b
    where b.captain_id = captain_live.captain_id and b.client_id = auth.uid() and b.status = 'accepted'
  )
);

create or replace function public.nearby_captains(p_lat double precision, p_lng double precision, p_radius_km double precision default 20)
returns table (captain_id uuid, distance_km numeric)
language sql stable security definer set search_path = public as $$
  select l.captain_id, round(public.km_between(p_lat, p_lng, l.lat, l.lng)::numeric, 1)
  from public.captain_live l
  join public.captains c on c.user_id = l.captain_id
  join public.profiles cp on cp.id = c.user_id
  join public.profiles me on me.id = auth.uid() and me.role = 'client'
  where c.status = 'approved' and c.online and c.active_until > now()
    and cp.gender = me.gender
    and l.updated_at > now() - interval '3 minutes'
    and public.km_between(p_lat, p_lng, l.lat, l.lng) <= least(p_radius_km, 20)
  order by 2
  limit 30;
$$;
revoke execute on function public.nearby_captains(double precision, double precision, double precision) from anon;

-- ---------------------------------------------------------------------
-- 3) Accounts are created together with their profile (no half-made accounts
--    if the connection drops during sign-up).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := new.raw_user_meta_data;
begin
  if m ? 'role' and m ? 'name' and m ? 'phone' and m ? 'gender' then
    insert into public.profiles (id, role, name, phone, gender)
    values (new.id, m->>'role', m->>'name', m->>'phone', m->>'gender')
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4) No request spam: a rider can have at most 2 requests waiting at once.
-- ---------------------------------------------------------------------
create or replace function public.limit_pending_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.bookings where client_id = new.client_id and status = 'pending') >= 2 then
    raise exception 'too many pending requests';
  end if;
  return new;
end $$;
drop trigger if exists bookings_limit_pending on public.bookings;
create trigger bookings_limit_pending before insert on public.bookings
  for each row execute function public.limit_pending_requests();

-- ---------------------------------------------------------------------
-- 5) Uploads: a person can keep at most 30 files (stops filling the free storage).
-- ---------------------------------------------------------------------
drop policy if exists documents_upload on storage.objects;
create policy documents_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (select count(*) from storage.objects o where o.bucket_id = 'documents' and (storage.foldername(o.name))[1] = auth.uid()::text) < 30
);

select 'تمام ✅ تحديثات الأمان اتطبقت' as result;
