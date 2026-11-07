import { useRef, useState, type ReactNode } from 'react';
import { Camera, Check, IdCard, FileBadge, Bike, UserRound, Hash, MapPinned } from 'lucide-react';
import { Button, Field, Page, TopBar, cx } from '@/components/ui';
import { BikeArt } from '@/components/art';
import { BIKE_CLASSES, GOVERNORATES } from '@/lib/config';
import { compressImage } from '@/lib/format';
import { logout, submitCaptainProfile } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { BikeClassId, CaptainProfile, User } from '@/lib/types';

type Photos = Pick<CaptainProfile, 'photo' | 'idPhoto' | 'licensePhoto' | 'bikePhoto'>;

export function Apply({ user, prev }: { user: User; prev?: CaptainProfile }) {
  const [bike, setBike] = useState<BikeClassId>(prev?.bikeClass ?? 'scooter');
  const [model, setModel] = useState(prev?.bikeModel ?? '');
  const [plate, setPlate] = useState(prev?.plate ?? '');
  const [gov, setGov] = useState(prev?.governorate ?? GOVERNORATES[0]);
  const [nid, setNid] = useState(prev?.nationalId ?? '');
  // documents are re-uploaded on every (re)application so the reviewer always sees fresh copies
  const [photos, setPhotos] = useState<Photos>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const er: Record<string, string> = {};
    if (model.trim().length < 2) er.model = 'اكتب نوع وموديل الموتوسيكل';
    if (plate.trim().length < 3) er.plate = 'اكتب رقم النمرة';
    if (!/^\d{14}$/.test(nid)) er.nid = 'الرقم القومي 14 رقم';
    if (!photos.photo || !photos.idPhoto || !photos.licensePhoto || !photos.bikePhoto) er.photos = 'ارفع الأربع صور';
    setErrors(er);
    if (Object.keys(er).length) return toast('كمّل البيانات الناقصة', 'err');
    setBusy(true);
    const ok = await submitCaptainProfile({ userId: user.id, bikeClass: bike, bikeModel: model.trim(), plate: plate.trim(), governorate: gov, nationalId: nid, ...photos });
    setBusy(false);
    if (ok) toast('اتبعت طلبك للمراجعة ✨');
  };

  return (
    <Page>
      <TopBar title="بيانات الكابتن" sub={`أهلاً ${user.name} — خطوة واحدة وتبدأ`} right={<button onClick={logout} className="text-xs text-muted">خروج</button>} />
      <div className="px-5 pb-10 space-y-6">
        {prev?.status === 'rejected' && (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">طلبك اترفض: {prev.rejectReason || 'راجع البيانات'} — عدّل وابعته تاني</div>
        )}
        <section className="space-y-3">
          <h3 className="text-sm text-muted">نوع الموتوسيكل</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {BIKE_CLASSES.map((b) => (
              <button key={b.id} onClick={() => setBike(b.id)} className={cx('glass rounded-2xl p-3 text-right transition', bike === b.id && 'border-acc! bg-acc/8')}>
                <BikeArt kind={b.id} className="w-full h-12" />
                <span className="text-sm font-medium mt-1 block">{b.name}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <Field label="الماركة والموديل" icon={<Bike />} value={model} onChange={(e) => setModel(e.target.value)} placeholder="مثلاً: Honda Dio 2023" error={errors.model} />
          <Field label="رقم النمرة" icon={<Hash />} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="أ ب ج 1234" error={errors.plate} />
          <Field label="الرقم القومي" icon={<IdCard />} value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="14 رقم" inputMode="numeric" dir="ltr" className="text-right" error={errors.nid} />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted px-1">المحافظة</span>
            <div className="flex items-center gap-3 h-14 px-4 rounded-2xl glass">
              <MapPinned className="size-5 text-muted" />
              <select value={gov} onChange={(e) => setGov(e.target.value)} className="flex-1 bg-transparent outline-none text-[15px] [&>option]:bg-[#0b0d14]">
                {GOVERNORATES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </label>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm text-muted">المستندات</h3>
          <div className="grid grid-cols-2 gap-3">
            <Upload label="صورتك الشخصية" icon={<UserRound />} value={photos.photo} onChange={(v) => setPhotos((p) => ({ ...p, photo: v }))} />
            <Upload label="البطاقة" icon={<IdCard />} value={photos.idPhoto} onChange={(v) => setPhotos((p) => ({ ...p, idPhoto: v }))} />
            <Upload label="رخصة القيادة" icon={<FileBadge />} value={photos.licensePhoto} onChange={(v) => setPhotos((p) => ({ ...p, licensePhoto: v }))} />
            <Upload label="صورة الموتوسيكل" icon={<Bike />} value={photos.bikePhoto} onChange={(v) => setPhotos((p) => ({ ...p, bikePhoto: v }))} />
          </div>
          {errors.photos && <p className="text-[11px] text-danger px-1">{errors.photos}</p>}
          <p className="text-[11px] text-muted px-1">بياناتك بيشوفها فريق المراجعة بس، ومش بتظهر للركاب.</p>
        </section>
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          ابعت للمراجعة
        </Button>
      </div>
    </Page>
  );
}

export function Upload({ label, icon, value, onChange }: { label: string; icon: ReactNode; value?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" onClick={() => ref.current?.click()} className={cx('relative aspect-[4/3] rounded-2xl overflow-hidden glass grid place-items-center text-center transition hover:bg-surface-2', value && 'border-acc/50!')}>
      {value ? (
        <>
          <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-[11px] flex items-center gap-1 justify-center">
            <Check className="size-3.5 text-ok" /> {label}
          </div>
        </>
      ) : (
        <div className="text-muted">
          <span className="block mx-auto size-10 rounded-xl bg-acc/10 text-acc grid place-items-center [&>svg]:size-5">{busy ? <Camera className="animate-pulse" /> : icon}</span>
          <span className="block text-[11px] mt-2">{label}</span>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onChange(await compressImage(f));
          } catch (err) {
            toast((err as Error).message, 'err');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </button>
  );
}
