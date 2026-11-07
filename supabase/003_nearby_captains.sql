-- =====================================================================
--  في السكة · تحديث 3 — الكباتن القريبين + تفعيل الاشتراك من الإدارة
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة.
-- =====================================================================

-- Riders may see the position of captains who are online and available,
-- so the app can show the nearest captains first (like any ride app).
drop policy if exists captain_live_read on public.captain_live;
create policy captain_live_read on public.captain_live for select to authenticated using (
  captain_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings b
    where b.captain_id = captain_live.captain_id and b.client_id = auth.uid() and b.status = 'accepted'
  )
  or exists (
    select 1 from public.captains c
    where c.user_id = captain_live.captain_id and c.status = 'approved' and c.online and c.active_until > now()
  )
);

-- going offline also stops showing the captain's position
create or replace function public.set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.captains set online = p_online
  where user_id = auth.uid() and (not p_online or (status = 'approved' and active_until > now()));
  if not p_online then
    delete from public.captain_live where captain_id = auth.uid()
      and not exists (select 1 from public.bookings where captain_id = auth.uid() and status = 'accepted');
  end if;
end $$;

-- Admin: activate a captain's subscription without an InstaPay payment
-- (free trial, cash payment, ...). Adds p_days on top of any remaining time.
create or replace function public.admin_grant_subscription(p_user uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_days not between 1 and 730 then raise exception 'bad days'; end if;
  update public.captains
  set active_until = greatest(now(), coalesce(active_until, now())) + make_interval(days => p_days)
  where user_id = p_user and status = 'approved';
  if not found then raise exception 'captain not approved'; end if;
  perform public.notify_user(p_user, 'اشتراكك اتفعّل لمدة ' || p_days || ' يوم ✅ — اعمل أونلاين وابدأ تستقبل مشاوير');
end $$;

select 'تمام ✅ الكباتن القريبين وتفعيل الاشتراك جاهزين' as result;
