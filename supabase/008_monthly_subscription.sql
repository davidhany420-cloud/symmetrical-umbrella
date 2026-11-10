-- =====================================================================
--  في السكة · تحديث 8 — اشتراك الكابتن بقى شهري (30 يوم) بدل سنة
--  الصقه في Supabase → SQL Editor → New query → Run
--  آمن إنك تشغّله أكتر من مرة. الاشتراكات اللي اتفعّلت قبل كده مش بتتغير.
-- =====================================================================
create or replace function public.admin_review_payment(p_payment uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_captain uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.payments set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
  where id = p_payment and status = 'pending' returning captain_id into v_captain;
  if v_captain is null then raise exception 'payment not pending'; end if;
  if p_approve then
    update public.captains set active_until = greatest(now(), coalesce(active_until, now())) + interval '30 days'
    where user_id = v_captain;
  end if;
  perform public.notify_user(v_captain, case when p_approve
    then 'اتأكدنا من الدفع — اشتراكك شغال شهر كامل ✅'
    else 'مش لاقيين التحويل ده — راجع رقم المرجع وابعته تاني' end);
end $$;

select 'تمام ✅ الاشتراك بقى شهري' as result;
