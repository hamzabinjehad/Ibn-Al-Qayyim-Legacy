import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useListBooks, useListCategories } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { BookOpen, ChevronLeft, Search, SlidersHorizontal } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "التزكية والسلوك": "#B45309",
  "السيرة والفقه":   "#15803D",
  "الرقائق والحكم":  "#1D4ED8",
  "العقيدة":         "#7E22CE",
  "الفقه وأصوله":   "#0F766E",
  "علوم القرآن":    "#B91C1C",
};

/** Strip edition/publisher suffix to get the display title */
function baseTitle(title: string): string {
  return title
    .replace(/\s*=\s*[؀-ۿ\s،؛؟]+/, "")
    .replace(/\s*-\s*(ط|ت)\s+.+$/, "")
    .trim();
}

/** Extract the edition label from a title, e.g. "ط عطاءات العلم" */
function editionLabel(title: string): string | null {
  const m = title.match(/\s*-\s*(ط|ت)\s+(.+)$/);
  return m ? m[2]! : null;
}

export default function Library() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const selectedCategory = params.get("category") ?? "";
  const [localSearch, setLocalSearch] = useState("");

  const { data: books, isLoading } = useListBooks(
    selectedCategory ? { category: selectedCategory } : {}
  );
  const { data: categories } = useListCategories();

  const filtered = books?.filter((b) => {
    if (!localSearch.trim()) return true;
    const q = localSearch.toLowerCase();
    return (
      b.titleAr.toLowerCase().includes(q) ||
      baseTitle(b.titleAr).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="reader-surface soft-panel rounded-3xl p-6 md:p-7 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-sm text-primary font-semibold mb-2">المكتبة الكاملة</p>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">كل مؤلفات ابن القيم في مكان واحد</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                صف الكتب حسب الموضوع أو ابحث باسم الكتاب، ثم انتقل مباشرة إلى الفهرس والفصول.
              </p>
            </div>
            {books && (
              <div className="grid grid-cols-2 gap-3 min-w-[13rem]">
                <div className="rounded-2xl bg-card/80 border border-border/70 p-4">
                  <p className="text-2xl font-bold text-primary">{books.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">كتاب ظاهر</p>
                </div>
                <div className="rounded-2xl bg-card/80 border border-border/70 p-4">
                  <p className="text-2xl font-bold text-primary">{filtered?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">نتيجة مطابقة</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search + Category filters */}
        <div className="sticky top-20 z-20 reader-surface soft-panel rounded-2xl p-3 flex flex-col gap-3 mb-8">
          {/* Local search */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="ابحث عن كتاب..."
              className="w-full pr-10 pl-4 py-3 rounded-xl border border-border bg-card/85 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              تصفية
            </span>
            <Link
              href="/library"
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
              data-testid="filter-all-categories"
            >
              الكل
            </Link>
            {categories?.map((cat) => (
              <Link
                href={`/library?category=${encodeURIComponent(cat.name)}`}
                key={cat.name}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedCategory === cat.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                data-testid={`filter-category-${cat.name}`}
              >
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        </div>

        {/* Book grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card animate-pulse h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered?.map((book) => {
              const title = baseTitle(book.titleAr);
              const edition = editionLabel(book.titleAr);
              const categoryColor = CATEGORY_COLORS[book.category] ?? "#78716c";

              return (
                <Link
                  href={`/book/${book.id}`}
                  key={book.id}
                  className="group soft-panel flex flex-col rounded-2xl bg-card/90 overflow-hidden hover:border-primary/45 transition-all duration-200"
                  data-testid={`card-book-${book.id}`}
                >
                  {/* Cover */}
                  <div
                    className="h-28 relative flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: book.coverColor }}
                  >
                    <svg
                      className="absolute inset-0 w-full h-full opacity-10"
                      viewBox="0 0 80 80"
                      preserveAspectRatio="xMidYMid slice"
                    >
                      <defs>
                        <pattern
                          id={`pat-lib-${book.id}`}
                          x="0" y="0" width="20" height="20"
                          patternUnits="userSpaceOnUse"
                        >
                          <polygon
                            points="10,1 19,5.5 19,14.5 10,19 1,14.5 1,5.5"
                            fill="none" stroke="white" strokeWidth="0.6"
                          />
                          <circle cx="10" cy="10" r="2" fill="none" stroke="white" strokeWidth="0.4" />
                        </pattern>
                      </defs>
                      <rect width="80" height="80" fill={`url(#pat-lib-${book.id})`} />
                    </svg>
                    <BookOpen className="w-9 h-9 text-white/55 relative z-10 group-hover:text-white/80 transition-colors" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 p-4 gap-2.5">
                    {/* Category badge */}
                    <span
                      className="self-start text-[11px] px-2 py-0.5 rounded-full text-white font-medium leading-none"
                      style={{ backgroundColor: categoryColor }}
                    >
                      {book.category}
                    </span>

                    {/* Title */}
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {title}
                    </h3>

                    {/* Edition subtitle */}
                    {edition && (
                      <p className="text-[11px] text-muted-foreground leading-none">
                        ط. {edition}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {book.chapterCount} فصل
                      </span>
                      <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        اقرأ
                        <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <div className="text-center py-20 reader-surface soft-panel rounded-3xl">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-semibold">لا توجد كتب تطابق بحثك</p>
            <p className="text-sm text-muted-foreground mt-1">جرّب كلمة أقصر أو أزل التصنيف المحدد.</p>
          </div>
        )}
      </div>
    </div>
  );
}
