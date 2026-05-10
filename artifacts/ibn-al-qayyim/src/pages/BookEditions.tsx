import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useListBooks } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { BookOpen, ChevronLeft, Layers } from "lucide-react";

// Strips edition/publisher suffixes to get the base title of a work.
// e.g. "مدارج السالكين - ط عطاءات العلم" → "مدارج السالكين"
// e.g. "الداء والدواء = الجواب الكافي - ط دار المعرفة" → "الداء والدواء"
export function extractBaseTitle(title: string): string {
  return title
    .replace(/\s*=\s*[؀-ۿ\s،؛؟]+/, "") // remove " = الجواب الكافي"
    .replace(/\s*-\s*(ط|ت)\s+.+$/, "")                          // remove " - ط ..." / " - ت ..."
    .trim();
}

const COVER_COLORS = [
  "#5C4033", "#3B4A6B", "#2D6A4F", "#7B3F00",
  "#1B4F72", "#4A235A", "#117A65", "#6E2C00",
];

const EDITION_LABELS: Record<string, string> = {
  "ط عطاءات العلم": "عطاءات العلم",
  "ط العلمية": "دار الكتب العلمية",
  "ط الكتاب العربي": "دار الكتاب العربي",
  "ط دار الحديث": "دار الحديث",
  "ط دار المعرفة": "دار المعرفة",
  "ط المدني": "دار المدني",
  "ط البيان": "دار البيان",
  "ط رمادي": "دار رمادي",
  "ط دار القلم": "دار القلم",
  "ط مكتبة ابن تيمية": "مكتبة ابن تيمية",
  "ط مكتبة الثقافة": "مكتبة الثقافة",
  "ط العاصمة": "دار العاصمة",
  "ط الدار السلفية": "الدار السلفية",
  "ط الشرق الأوسط": "دار الشرق الأوسط",
};

function getEditionLabel(title: string): string {
  for (const [key, label] of Object.entries(EDITION_LABELS)) {
    if (title.includes(key)) return label;
  }
  // Extract what comes after " - ط " or " - ت "
  const m = title.match(/\s*-\s*(ط|ت)\s+(.+)$/);
  if (m) return m[2]!;
  return title;
}

export default function BookEditions() {
  const { slug } = useParams<{ slug: string }>();
  const baseTitle = decodeURIComponent(slug ?? "");

  const { data: books, isLoading } = useListBooks({});

  const editions = useMemo(() => {
    if (!books) return [];
    return books.filter((b) => extractBaseTitle(b.titleAr) === baseTitle);
  }, [books, baseTitle]);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Back */}
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          العودة إلى المكتبة
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-sm text-primary font-medium">اختر الطبعة</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-snug">{baseTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {!isLoading && `${editions.length} طبعة متاحة — اختر الطبعة التي تريد قراءتها`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : editions.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center">لم يُعثر على هذا الكتاب</p>
        ) : (
          <div className="space-y-4">
            {editions.map((book, i) => {
              const editionLabel = getEditionLabel(book.titleAr);
              const color = COVER_COLORS[i % COVER_COLORS.length]!;
              return (
                <Link
                  key={book.id}
                  href={`/book/${book.id}`}
                  className="flex items-center gap-5 p-5 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all group"
                >
                  {/* Color swatch */}
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    <BookOpen className="w-7 h-7 text-white/70" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {editionLabel}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{book.titleAr}</p>
                    <p className="text-xs text-primary mt-1 font-medium">{book.chapterCount} فصل</p>
                  </div>

                  <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
