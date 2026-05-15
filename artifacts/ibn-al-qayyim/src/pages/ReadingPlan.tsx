import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Diamond, Layers, Library, Route, type LucideIcon } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { LoadingState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import { normalizeArabicTitle } from "@/lib/book-titles";
import { type WorkSummary, useStaticWorks } from "@/lib/static-library";

interface ReadingPlanItem {
  matchTitle: string;
  title: string;
  volumeLabel: string;
  note?: string;
}

const RIGHT_COLUMN: ReadingPlanItem[] = [
  { title: "الوابل الصيب ورافع الكلم الطيب", matchTitle: "الوابل الصيب", volumeLabel: "مجلد" },
  { title: "الداء والدواء - الجواب الكافي", matchTitle: "الداء والدواء", volumeLabel: "مجلد" },
  { title: "الفوائد", matchTitle: "الفوائد لابن القيم", volumeLabel: "مجلد" },
  { title: "كتاب الصلاة", matchTitle: "الصلاة", volumeLabel: "مجلد" },
  { title: "الرسالة التبوكية", matchTitle: "الرسالة التبوكية زاد المهاجر إلى ربه", volumeLabel: "رسالة", note: "من الرسائل" },
  { title: "رسالة ابن القيم إلى أحد إخوانه", matchTitle: "رسالة ابن القيم إلى أحد إخوانه", volumeLabel: "رسالة", note: "من الرسائل" },
  { title: "رسالة في صيغ الحمد", matchTitle: "صيغ الحمد", volumeLabel: "رسالة", note: "من الرسائل" },
  { title: "زاد المعاد في هدي خير العباد", matchTitle: "زاد المعاد في هدي خير العباد", volumeLabel: "7 مجلدات" },
  { title: "عدة الصابرين وذخيرة الشاكرين", matchTitle: "عدة الصابرين وذخيرة الشاكرين", volumeLabel: "مجلد" },
  { title: "التبيان في أيمان القرآن", matchTitle: "التبيان في أيمان القرآن", volumeLabel: "مجلد" },
  { title: "المنار المنيف في الصحيح والضعيف", matchTitle: "المنار المنيف في الصحيح والضعيف", volumeLabel: "مجلد" },
  { title: "إغاثة اللهفان من مصايد الشيطان", matchTitle: "إغاثة اللهفان في مصايد الشيطان", volumeLabel: "مجلدان" },
  {
    title: "مفتاح دار السعادة ومنشور ولاية العلم والإرادة",
    matchTitle: "مفتاح دار السعادة ومنشور ولاية العلم والإرادة",
    volumeLabel: "ثلاثة مجلدات",
  },
  { title: "حادي الأرواح إلى بلاد الأفراح", matchTitle: "حادي الأرواح إلى بلاد الأفراح", volumeLabel: "مجلدان" },
  { title: "جلاء الأفهام في فضل الصلاة والسلام على خير الأنام", matchTitle: "جلاء الأفهام", volumeLabel: "مجلد" },
  { title: "إعلام الموقعين عن رب العالمين", matchTitle: "إعلام الموقعين عن رب العالمين", volumeLabel: "6 مجلدات" },
  { title: "تحفة المودود بأحكام المولود", matchTitle: "تحفة المودود بأحكام المولود", volumeLabel: "مجلد" },
];

const LEFT_COLUMN: ReadingPlanItem[] = [
  { title: "روضة المحبين ونزهة المشتاقين", matchTitle: "روضة المحبين ونزهة المشتاقين", volumeLabel: "مجلد" },
  { title: "إغاثة اللهفان في حكم طلاق الغضبان", matchTitle: "إغاثة اللهفان في حكم طلاق الغضبان", volumeLabel: "مجلد" },
  { title: "رفع اليدين في الصلاة", matchTitle: "رفع اليدين في الصلاة", volumeLabel: "مجلد" },
  { title: "تهذيب سنن أبي داود", matchTitle: "تهذيب سنن أبي داود", volumeLabel: "3 مجلدات" },
  { title: "الكلام على مسألة السماع", matchTitle: "الكلام على مسألة السماع", volumeLabel: "مجلد" },
  {
    title: "اجتماع الجيوش الإسلامية على غزو المعطلة والجهمية",
    matchTitle: "اجتماع الجيوش الإسلامية",
    volumeLabel: "مجلد",
  },
  { title: "الفروسية المحمدية", matchTitle: "الفروسية المحمدية", volumeLabel: "مجلد" },
  { title: "بدائع الفوائد", matchTitle: "بدائع الفوائد", volumeLabel: "5 مجلدات" },
  {
    title: "الكافية الشافية في الانتصار للفرقة الناجية",
    matchTitle: "الكافية الشافية",
    volumeLabel: "3 مجلدات",
  },
  {
    title: "الصواعق المرسلة على الجهمية والمعطلة",
    matchTitle: "الصواعق المرسلة على الجهمية والمعطلة",
    volumeLabel: "مجلدان",
  },
  { title: "الروح", matchTitle: "الروح", volumeLabel: "مجلدان" },
  {
    title: "شفاء العليل في مسائل القضاء والقدر والحكمة والتعليل",
    matchTitle: "شفاء العليل في مسائل القضاء والقدر والحكمة والتعليل",
    volumeLabel: "مجلد",
  },
  { title: "طريق الهجرتين وباب السعادتين", matchTitle: "طريق الهجرتين وباب السعادتين", volumeLabel: "مجلدان" },
  {
    title: "مدارج السالكين بين منازل إياك نعبد وإياك نستعين",
    matchTitle: "مدارج السالكين",
    volumeLabel: "أربعة مجلدات",
  },
  { title: "الطرق الحكمية", matchTitle: "الطرق الحكمية في السياسة الشرعية", volumeLabel: "مجلدان" },
  { title: "أحكام أهل الذمة", matchTitle: "أحكام أهل الذمة", volumeLabel: "مجلدان" },
  { title: "هداية الحيارى في أجوبة اليهود والنصارى", matchTitle: "هداية الحيارى في أجوبة اليهود والنصارى", volumeLabel: "مجلد" },
];

const PLAN_COLUMNS = [RIGHT_COLUMN, LEFT_COLUMN];
const PLAN_ITEMS = PLAN_COLUMNS.flat();

function findWork(works: WorkSummary[] | undefined, matchTitle: string) {
  if (!works) return undefined;
  const normalizedMatch = normalizeArabicTitle(matchTitle);
  const exact = works.find((work) => normalizeArabicTitle(work.titleAr) === normalizedMatch);
  if (exact) return exact;
  return works.find((work) => {
    const normalizedTitle = normalizeArabicTitle(work.titleAr);
    return normalizedTitle.includes(normalizedMatch) || normalizedMatch.includes(normalizedTitle);
  });
}

export default function ReadingPlan() {
  const { data: works, isLoading } = useStaticWorks();

  const resolvedColumns = useMemo(() => {
    return PLAN_COLUMNS.map((column) =>
      column.map((item) => {
        const work = findWork(works, item.matchTitle);
        return {
          ...item,
          href: work ? `/work/${work.id}` : undefined,
          work,
        };
      }),
    );
  }, [works]);

  const linkedCount = resolvedColumns.flat().filter((item) => item.href).length;

  return (
    <AppShell>
      <PageFrame className="overflow-hidden" containerClassName="pb-24 md:pb-16">
        <header className="grid min-w-0 gap-8 border-b border-border pb-8 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Route className="h-4 w-4" />
              خطة قراءة
            </div>
            <h1 className="max-w-full break-words font-display text-3xl font-bold leading-tight md:text-6xl">
              ترتيب مقترح لقراءة كتب الإمام ابن القيم
            </h1>
          </div>

          <aside className="self-end rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">ملخص الخطة</p>
            <div className="mt-4 space-y-3">
              <p className="flex items-center justify-between">
                <span>الأعمال</span>
                <span className="tabular-nums text-foreground">{PLAN_ITEMS.length}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>أعمال متاحة</span>
                <span className="tabular-nums text-foreground">{isLoading ? "..." : linkedCount}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>المجلدات</span>
                <span className="text-foreground">64 تقريباً</span>
              </p>
            </div>
          </aside>
        </header>

        {isLoading ? (
          <LoadingState />
        ) : (
          <section className="grid min-w-0 gap-8 pt-8 lg:grid-cols-2">
            {resolvedColumns.map((column, columnIndex) => (
              <ol className="min-w-0 space-y-3" key={columnIndex}>
                {column.map((item, itemIndex) => {
                  const order = columnIndex * RIGHT_COLUMN.length + itemIndex + 1;
                  return <ReadingPlanRow item={item} key={item.title} order={order} />;
                })}
              </ol>
            ))}
          </section>
        )}

        <section className="mt-10 grid gap-4 border-t border-border pt-8 md:grid-cols-3">
          <PlanStat icon={Layers} label="المجموع" value="أربعة وستون مجلداً تقريباً" />
          <PlanStat icon={Library} label="الأعمال" value={`${PLAN_ITEMS.length} عملاً`} />
          <PlanStat icon={BookOpen} label="الوتيرة" value="ورد يومي ثابت لمدة سنة" />
        </section>
      </PageFrame>
    </AppShell>
  );
}

function ReadingPlanRow({
  item,
  order,
}: {
  item: ReadingPlanItem & { href?: string; work?: WorkSummary };
  order: number;
}) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-xs tabular-nums text-muted-foreground">
        {order}
      </span>
      <Diamond className="mt-2 h-3.5 w-3.5 shrink-0 text-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-8">{item.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{item.volumeLabel}</span>
          {item.note && <span>{item.note}</span>}
          {item.work && item.work.editionCount > 1 && <span>{item.work.editionCount} طبعات متاحة</span>}
          {!item.work && <span>غير متاح في البيانات المحلية</span>}
        </span>
      </span>
      {item.href && <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />}
    </>
  );

  if (!item.href) {
    return (
    <li className="flex min-w-0 items-start gap-3 rounded-lg border border-dashed border-border p-4 text-muted-foreground opacity-80">
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className="group flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground hover:bg-muted/30"
      >
        {content}
      </Link>
    </li>
  );
}

function PlanStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <Icon className="h-5 w-5 text-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold leading-7">{value}</p>
    </div>
  );
}
