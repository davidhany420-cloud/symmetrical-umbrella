import type { ReactNode } from 'react';
import { Page, TopBar } from '@/components/ui';
import { back } from '@/lib/router';
import { SUPPORT_WHATSAPP } from '@/lib/config';

/** Public privacy policy (also the "how to delete your account" page Google Play asks for). */
export function Privacy() {
  return (
    <Page>
      <TopBar title="سياسة الخصوصية" sub="في السكة · آخر تحديث نوفمبر 2026" onBack={() => back('/')} />
      <article className="px-5 pb-12 space-y-6 text-[15px] leading-relaxed">
        <p className="text-muted">
          الصفحة دي بتشرح البيانات اللي تطبيق "في السكة" بيجمعها، وبيستخدمها في إيه، ومين بيشوفها، وإزاي تمسح حسابك.
        </p>

        <Section title="البيانات اللي بنجمعها">
          <Li>
            <b>للكل:</b> الاسم، رقم الموبايل، النوع (شاب / بنت)، وكلمة السر (متخزنة متشفّرة).
          </Li>
          <Li>
            <b>الموقع:</b> مكان الركوب والوجهة اللي بتختارهم. وللكابتن: مكانه وهو أونلاين أو في مشوار، علشان الركاب القريبين يلاقوه والراكب يتابعه.
          </Li>
          <Li>
            <b>للكباتن:</b> الرقم القومي، صورة شخصية، صورة البطاقة، الرخصة، الموتوسيكل، ونمرته، وإيصالات تحويل الاشتراك.
          </Li>
          <Li>
            <b>المشاوير:</b> الأماكن، المسافة، السعر، الوقت، رسايل الشات، والتقييمات.
          </Li>
        </Section>

        <Section title="بنستخدمها في إيه">
          <Li>نوصّل الراكب بأقرب كابتن مناسب، ونحسب سعر المشوار بالكيلو.</Li>
          <Li>نتأكد من هوية الكباتن قبل ما يشتغلوا (مراجعة المستندات).</Li>
          <Li>أمان المشوار: التتبع المباشر، مشاركة المشوار، والتقييمات.</Li>
          <Li>الرد على الشكاوى وحل المشاكل.</Li>
        </Section>

        <Section title="مين بيشوف بياناتك">
          <Li>
            <b>الطرف التاني في المشوار:</b> اسمك، ورقم موبايلك بعد ما المشوار يتأكد بس. الكابتن بيشوف مكان الركوب والوجهة، والراكب بيشوف مكان الكابتن أثناء المشوار.
          </Li>
          <Li>
            <b>الركاب القريبين:</b> اسم الكابتن وتقييمه وبُعده بالكيلو بس — من غير رقمه ولا مكانه بالظبط.
          </Li>
          <Li>
            <b>إدارة التطبيق:</b> كل البيانات، علشان المراجعة والدعم.
          </Li>
          <Li>
            <b>الجهات الرسمية:</b> لو طلبتها طبقاً للقانون المصري (القانون 87 لسنة 2018).
          </Li>
          <Li>مستندات الكباتن (البطاقة والرخصة) محدش بيشوفها غير الكابتن نفسه والإدارة.</Li>
          <Li>مش بنبيع بياناتك لأي حد.</Li>
        </Section>

        <Section title="فين بتتخزن">
          <Li>على خوادم Supabase في الاتحاد الأوروبي (فرانكفورت)، ومحمية بقواعد صلاحيات: كل واحد بيوصل لبياناته بس.</Li>
          <Li>الخريطة والبحث عن الأماكن من OpenStreetMap — بنبعتلهم مكان الخريطة اللي بتبص عليه واسم المكان اللي بتدوّر عليه بس.</Li>
        </Section>

        <Section title="مسح الحساب">
          <Li>
            من جوه التطبيق: <b>حسابي ← امسح حسابي</b>. الحساب بيتقفل على طول ومحدش يقدر يشوفه أو يطلب منك مشاوير.
          </Li>
          <Li>القانون بيلزمنا نحتفظ ببيانات المشاوير 180 يوم، وبعدها بتتمسح نهائياً.</Li>
          <Li>
            لو مش قادر تدخل التطبيق، كلّمنا على واتساب{' '}
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} className="text-acc underline" dir="ltr">
              +{SUPPORT_WHATSAPP}
            </a>{' '}
            وهنمسحه لك.
          </Li>
        </Section>

        <Section title="حقوقك">
          <Li>تقدر تطلب نسخة من بياناتك، أو تصليح أي حاجة غلط فيها، من خلال الدعم.</Li>
          <Li>تقدر تقفل صلاحية الموقع من إعدادات الموبايل في أي وقت (بس ساعتها مش هتقدر تطلب مشوار أو تشتغل ككابتن).</Li>
        </Section>
      </article>
    </Page>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2.5">
    <h2 className="text-lg font-bold text-grad">{title}</h2>
    <ul className="space-y-2">{children}</ul>
  </section>
);
const Li = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-2.5 text-text/90">
    <span className="mt-2.5 size-1.5 rounded-full bg-acc shrink-0" />
    <span>{children}</span>
  </li>
);
