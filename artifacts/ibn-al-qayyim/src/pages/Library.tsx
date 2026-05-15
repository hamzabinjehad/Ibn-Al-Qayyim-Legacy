import { useMemo, useState } from "react";
import { Grid2X2, List, Search as SearchIcon, X } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { WorkCard, WorkRow } from "@/components/editorial/BookCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import { useLocalLibrary } from "@/lib/local-library";
import { useStaticWorks } from "@/lib/static-library";
import { useUiTranslations, worksCountText } from "@/lib/ui-translations";

function normalize(value: string) {
  return value
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export default function Library() {
  const { direction, language, t } = useUiTranslations();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: books, isLoading, isError, refetch } = useStaticWorks();
  const { positions } = useLocalLibrary();
  const progressByBookId = useMemo(() => {
    const progress = new Map<number, number>();
    positions.forEach((position) => {
      if (!progress.has(position.workId ?? position.bookId)) progress.set(position.workId ?? position.bookId, position.progress);
    });
    return progress;
  }, [positions]);

  const filteredBooks = useMemo(() => {
    if (!books) return [];
    if (!query.trim()) return books;
    const q = normalize(query);
    return books.filter((book) => normalize(`${book.titleAr} ${book.description}`).includes(q));
  }, [books, query]);

  return (
    <AppShell>
      <PageFrame containerClassName="pt-12">
        <header className="border-b border-border pb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{t("المكتبة")}</h1>
          </div>
        </header>

        <div className="min-w-0 pt-8">
          <section className="min-w-0" data-tour="library-books">
            <div className="reader-chrome sticky top-16 z-30 mb-7 rounded-lg px-3 py-4 sm:px-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("ابحث باسم الكتاب")}
                    className="h-12 w-full rounded-lg border border-border bg-background ps-11 pe-11 text-sm focus:border-foreground focus:outline-none"
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
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors ${
                      view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                  >
                    <Grid2X2 className="h-4 w-4" />
                    {t("بطاقات")}
                  </button>
                  <button
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors ${
                      view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    type="button"
                  >
                    <List className="h-4 w-4" />
                    {t("قائمة")}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {isLoading ? t("جار تحميل الكتب") : worksCountText(filteredBooks.length, books?.length ?? 0, language)}
              </p>
            </div>

            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
            ) : books?.length === 0 ? (
              <EmptyState title="لا توجد كتب لهذه اللغة" description="اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها." />
            ) : filteredBooks.length === 0 ? (
              <EmptyState title="لا توجد نتائج" description="جرب كلمة أقصر أو ابحث باسم آخر للكتاب." />
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBooks.map((book) => (
                  <WorkCard work={book} key={book.id} progress={progressByBookId.get(book.id)} />
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
