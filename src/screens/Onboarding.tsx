import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, Radar, HandCoins, Sparkles } from 'lucide-react';
import { BikeArt, Wordmark } from '@/components/art';
import { Button, Page, Segmented, cx } from '@/components/ui';
import { go, useRoute } from '@/lib/router';
import { finishOnboarding } from '@/lib/actions';

const FEATURES = [
  { icon: Radar, t: 'تتبع لحظي', d: 'شوف الكابتن على الخريطة لحد باب البيت' },
  { icon: HandCoins, t: 'سعرك إنت', d: 'اعرض السعر وتفاوض مع الكابتن مباشرة' },
  { icon: ShieldCheck, t: 'كباتن موثّقين', d: 'بطاقة ورخصة متراجعين من فريقنا' },
];

export function Onboarding({ skipIntro }: { skipIntro: boolean }) {
  const { query } = useRoute();
  const mode = query.get('mode') === 'girls' ? 'girls' : 'boys';
  const start = (to: string) => {
    finishOnboarding();
    go(to);
  };

  return (
    <Page className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-48px)] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      <div className="flex items-center justify-between">
        <Wordmark />
        <button onClick={() => start('/auth?role=client')} className="text-sm text-muted hover:text-text">
          دخول
        </button>
      </div>

      {/* hero */}
      <div className="relative mt-6 rounded-[32px] glass grid-bg overflow-hidden px-5 pt-6 pb-4">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-64 rounded-full bg-acc/25 blur-3xl" />
        <div className="relative flex items-center gap-2 text-[11px] text-acc tracking-[0.25em]" dir="ltr">
          <span className="size-1.5 rounded-full bg-acc animate-pulse" /> LIVE · 2026
        </div>
        <h1 className="relative mt-3 text-[34px] leading-[1.15] font-bold tracking-tight">
          مشوارك اليومي
          <br />
          <span className="text-grad">على موتوسيكل.</span>
        </h1>
        <p className="relative mt-3 text-sm text-muted leading-relaxed max-w-[300px]">
          اشتراك شهري أو مشوار واحد — للجامعة، للشغل، للدرس. أسرع من الزحمة وأوفر من التاكسي.
        </p>
        <motion.div key={mode} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', damping: 18 }} className="relative -mx-2 mt-2">
          <BikeArt kind={mode === 'girls' ? 'electric' : 'sport'} className="w-full h-auto" />
        </motion.div>
      </div>

      {/* boys / girls */}
      <div className="mt-5">
        <Segmented
          value={mode}
          onChange={(v) => go(v === 'girls' ? '/?mode=girls' : '/', true)}
          options={[
            { value: 'boys', label: 'سكة الشباب' },
            { value: 'girls', label: 'سكة البنات' },
          ]}
        />
        <p className={cx('mt-3 text-center text-xs text-muted transition')}>
          {mode === 'girls' ? (
            <>
              <Sparkles className="inline size-3.5 text-acc ml-1" />
              البنات بيركبوا مع <span className="text-acc font-medium">كابتنات بنات بس</span> — أمان وراحة بال
            </>
          ) : (
            'كباتن شباب محترفين، خوذة مع كل مشوار'
          )}
        </p>
      </div>

      {!skipIntro && (
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {FEATURES.map(({ icon: I, t, d }, i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="glass rounded-2xl p-3">
              <I className="size-5 text-acc" />
              <div className="mt-2 text-[13px] font-semibold">{t}</div>
              <div className="mt-1 text-[10.5px] leading-snug text-muted">{d}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-6 space-y-3">
        <Button size="lg" className="w-full" onClick={() => start(`/auth?role=client&tab=register${mode === 'girls' ? '&g=f' : ''}`)}>
          يلا نبدأ <ArrowLeft className="size-5" />
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => start(`/auth?role=captain&tab=register${mode === 'girls' ? '&g=f' : ''}`)}>
          {mode === 'girls' ? 'انضمي ككابتن واكسبي' : 'انضم ككابتن واكسب'}
        </Button>
      </div>
    </Page>
  );
}
