import { useEffect, useState, type FormEvent } from 'react';
import { Phone, Lock, User as UserIcon, Eye, EyeOff, Bike, Users } from 'lucide-react';
import { Button, Field, Page, Segmented, cx } from '@/components/ui';
import { MotoArt, Wordmark } from '@/components/art';
import { go, useRoute } from '@/lib/router';
import { login, register } from '@/lib/actions';
import { validPhone } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Gender, Role } from '@/lib/types';

export function Auth() {
  const { query } = useRoute();
  const [role, setRole] = useState<Role>(query.get('role') === 'captain' ? 'captain' : 'client');
  const [tab, setTab] = useState<'login' | 'register'>(query.get('tab') === 'register' ? 'register' : 'login');
  const [gender, setGender] = useState<Gender>(query.get('g') === 'f' ? 'female' : 'male');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qRole = query.get('role');
  const qTab = query.get('tab');
  useEffect(() => {
    if (qRole === 'captain' || qRole === 'client') setRole(qRole);
    if (qTab === 'register' || qTab === 'login') setTab(qTab);
  }, [qRole, qTab]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!validPhone(phone)) er.phone = 'اكتب رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)';
    if (pass.length < 6) er.pass = 'كلمة السر لازم تكون 6 حروف أو أكتر';
    if (tab === 'register' && name.trim().length < 2) er.name = 'اكتب اسمك';
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      if (tab === 'register') {
        await register({ role, name, phone, gender, password: pass });
        toast(`أهلاً ${name.trim()} ✨`);
      } else {
        const u = await login(phone, pass);
        toast(`أهلاً بيك تاني يا ${u.name}`);
      }
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <header className="px-5 pt-[max(var(--sat),18px)] pb-2 flex items-center justify-between">
        <Wordmark />
      </header>
      <div className="px-5 pb-10">
        <div className="relative -mx-2 mt-2">
          <MotoArt className="w-full max-w-[300px] h-auto mx-auto" />
        </div>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">{tab === 'login' ? 'أهلاً بيك تاني' : role === 'captain' ? 'ابدأ كابتن معانا' : 'اعمل حسابك'}</h1>
        <p className="mt-1.5 text-sm text-muted">{tab === 'login' ? 'ادخل برقم موبايلك وكلمة السر' : 'دقيقة واحدة وتبقى في السكة'}</p>

        <div className="mt-6 space-y-3">
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: 'client', label: <><Users className="size-4" /> راكب</> },
              { value: 'captain', label: <><Bike className="size-4" /> كابتن</> },
            ]}
          />
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {tab === 'register' && (
            <>
              <Field label="الاسم" icon={<UserIcon />} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك اللي هيظهر للكابتن" error={errors.name} autoComplete="name" />
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted px-1">{role === 'captain' ? 'هتوصّل' : 'هتركب في'}</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => {
                        setGender(g);
                        document.documentElement.dataset.mode = g === 'female' ? 'girls' : 'boys';
                      }}
                      className={cx('h-14 rounded-2xl glass text-sm font-medium transition', gender === g ? 'border-acc! bg-acc/10 text-acc' : 'text-muted')}
                    >
                      {g === 'male' ? 'سكة الشباب' : 'سكة البنات'}
                    </button>
                  ))}
                </div>
                {gender === 'female' && (
                  <p className="text-[11px] text-acc px-1">{role === 'captain' ? 'هتوصّلي بنات بس 💜' : 'هتركبي مع كابتنات بنات بس 💜'}</p>
                )}
              </div>
            </>
          )}
          <Field label="رقم الموبايل" icon={<Phone />} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" dir="ltr" className="text-right" error={errors.phone} autoComplete="tel" />
          <div className="relative">
            <Field
              label="كلمة السر"
              icon={<Lock />}
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••"
              error={errors.pass}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-4 top-[38px] text-muted" aria-label="إظهار كلمة السر">
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          <Button size="lg" className="w-full !mt-6" loading={busy} type="submit">
            {tab === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {tab === 'login' ? 'معندكش حساب؟ ' : 'عندك حساب؟ '}
          <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')} className="text-acc font-medium">
            {tab === 'login' ? 'سجّل دلوقتي' : 'ادخل'}
          </button>
        </p>
        <p className="mt-6 text-center text-[11px] text-muted/70">
          بتسجيلك إنت موافق على{' '}
          <button onClick={() => go('/privacy')} className="underline underline-offset-4">
            سياسة الخصوصية
          </button>
        </p>

      </div>
    </Page>
  );
}
