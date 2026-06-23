import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "wouter";
import { Grid2X2, List, Search as SearchIcon, X } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import BookCover from "@/components/BookCover";
import { WorkCard, WorkRow } from "@/components/editorial/BookCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import ProgressLine from "@/components/editorial/ProgressLine";
import { prioritizeFeaturedWork } from "@/lib/featured-reading";
import { useLocalLibrary } from "@/lib/local-library";
import { useStaticCategories, useStaticWorks } from "@/lib/static-library";
import { useUiTranslations, worksCountText } from "@/lib/ui-translations";

function normalize(value: string) {
  return value
    .replace(/[ؐ-ًؚ-ٟۖ-ۭ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export default function Library() {
  const { direction, language, t } = useUiTranslations();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: books, isLoading, isError, refetch } = useStaticWorks();
  const { data: categories } = useStaticCategories();
  const { positions } = useLocalLibrary();

  const progressByBookId = useMemo(() => {
    const progress = new Map<number, number>();
    positions.forEach((position) => {
      if (!progress.has(position.workId ?? position.bookId))
        progress.set(position.workId ?? position.bookId, position.progress);
    });
    return progress;
  }, [positions]);

  const recentPositions = useMemo(
    () =>
      [...positions]
        .sort((a, b) => b.savedAt - a.savedAt)
        .filter((p, i, arr) => arr.findIndex((x) => (x.workId ?? x.bookId) === (p.workId ?? p.bookId)) === i)
        .slice(0, 8),
    [positions],
  );

  const recentWorks = useMemo(() => {
    if (!books || recentPositions.length === 0) return [];
    return recentPositions
      .map((pos) => books.find((b) => b.id === (pos.workId ?? pos.bookId)))
      .filter(Boolean) as typeof books;
  }, [books, recentPositions]);

  const filteredBooks = useMemo(() => {
    const orderedBooks = prioritizeFeaturedWork(books ?? []);
    if (!orderedBooks.length) return [];
    let result = orderedBooks;
    if (selectedCategory) result = result.filter((b) => b.category === selectedCategory);
    if (!deferredQuery.trim()) return result;
    const q = normalize(deferredQuery);
    return result.filter((book) =>
      normalize(`${book.titleAr} ${book.description}`).includes(q),
    );
  }, [books, deferredQuery, selectedCategory]);

  return (
    <AppShell>
      <PageFrame containerClassName="pt-7 sm:pt-10">
        <header className="border-b border-border pb-5 sm:pb-6">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {t("المكتبة")}
          </h1>
        </header>

        <div className="min-w-0 pt-4 sm:pt-6">
          {/* Continue reading shelf */}
          {recentWorks.length > 0 && (
            <section className="mb-8 sm:mb-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">{t("تابع القراءة")}</h2>
                <Link href="/saved" className="text-xs text-muted-foreground hover:text-foreground">
                  {t("عرض الكل")}
                </Link>
              </div>
              <div className="relative -mx-4 sm:-mx-6">
                <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-2 sm:px-6">
                  {recentWorks.map((work) => {
                    const pos = recentPositions.find((p) => (p.workId ?? p.bookId) === work.id);
                    const progress = progressByBookId.get(work.id);
                    const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;
                    return (
                      <Link
                        key={work.id}
                        href={`/work/${work.id}`}
                        className="interactive-card group flex w-36 shrink-0 flex-col p-2.5 sm:w-40"
                      >
                        <BookCover
                          coverColor={work.coverColor}
                          coverImageAlt={work.coverImageAlt}
                          coverImageUrl={work.coverImageUrl}
                          title={work.titleAr}
                          size="sm"
                          className="mx-auto !h-28 !w-20"
                        />
                        <p className="mt-2 text-center text-xs font-medium leading-5">
                          {work.titleAr}
                        </p>
                        {roundedProgress !== null && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <ProgressLine className="flex-1" value={roundedProgress} />
                            <span className="shrink-0 text-[0.6rem] tabular-nums text-muted-foreground">
                              {roundedProgress}٪
                            </span>
                          </div>
                        )}
                        {pos && (
                          <p className="mt-1 truncate text-center text-[0.65rem] text-muted-foreground">
                            {pos.chapterTitle}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 end-0 w-8"
                  style={{ background: "linear-gradient(to left, hsl(var(--background)) 0%, transparent 100%)" }}
                />
              </div>
            </section>
          )}

          <section className="min-w-0" data-tour="library-books">
            {/* Sticky search + controls bar */}
            <div className="reader-chrome sticky top-14 z-30 mb-5 rounded-lg px-2.5 py-2.5 sm:mb-6 sm:px-4 sm:py-3">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("ابحث باسم الكتاب")}
                    className="h-10 w-full rounded-lg border border-border bg-background ps-11 pe-11 text-sm transition-colors focus:border-foreground focus:outline-none"
                    dir={direction}
                  />
                  {query && (
                    <button
                      aria-label={t("مسح البحث")}
                      className="absolute end-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => setQuery("")}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors ${
                      view === "grid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                  >
                    <Grid2X2 className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{t("بطاقات")}</span>
                  </button>
                  <button
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors ${
                      view === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                  >
                    <List className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{t("قائمة")}</span>
                  </button>
                </div>
              </div>

              {/* Category filter chips */}
              {categories && categories.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
                        selectedCategory === null
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/40 bg-foreground/[.14] text-foreground hover:border-foreground/70 hover:bg-foreground/25"
                      }`}
                      type="button"
                    >
                      {language === "ar" ? "الكل" : language === "de" ? "Alle" : "All"}
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                          selectedCategory === cat.name
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/40 bg-foreground/[.14] text-foreground hover:border-foreground/70 hover:bg-foreground/25"
                        }`}
                        type="button"
                      >
                        {cat.name}
                        <span
                          className={`min-w-[1.1rem] rounded-full px-1 py-px text-center text-[0.6rem] font-bold tabular-nums leading-none ${
                            selectedCategory === cat.name
                              ? "bg-background/30 text-background"
                              : "bg-foreground/20 text-foreground"
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
            ) : books?.length === 0 ? (
              <EmptyState
                title="لا توجد كتب لهذه اللغة"
                description="اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها."
              />
            ) : filteredBooks.length === 0 ? (
              <EmptyState
                title="لا توجد نتائج"
                description="جرب كلمة أقصر أو ابحث باسم آخر للكتاب."
              />
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                {filteredBooks.map((book) => (
                  <WorkCard
                    work={book}
                    key={book.id}
                    progress={progressByBookId.get(book.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBooks.map((book) => (
                  <WorkRow work={book} key={book.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      </PageFrame>
    </AppShell>
  );
}
