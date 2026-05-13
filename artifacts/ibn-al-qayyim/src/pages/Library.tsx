import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Grid2X2, List, Search as SearchIcon } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { BookCard, BookRow } from "@/components/editorial/BookCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/editorial/DataState";
import { useLocalLibrary } from "@/lib/local-library";
import { useStaticBooks, useStaticCategories } from "@/lib/static-library";

function normalize(value: string) {
  return value
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export default function Library() {
  const search = useSearch();
  const selectedCategory = new URLSearchParams(search).get("category") ?? "";
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: books, isLoading, isError, refetch } = useStaticBooks(selectedCategory || undefined);
  const { data: categories } = useStaticCategories();
  const { positions } = useLocalLibrary();
  const progressByBookId = useMemo(() => {
    const progress = new Map<number, number>();
    positions.forEach((position) => {
      if (!progress.has(position.bookId)) progress.set(position.bookId, position.progress);
    });
    return progress;
  }, [positions]);

  const filteredBooks = useMemo(() => {
    if (!books) return [];
    if (!query.trim()) return books;
    const q = normalize(query);
    return books.filter((book) => normalize(`${book.titleAr} ${book.category}`).includes(q));
  }, [books, query]);

  return (
    <AppShell>
      <main className="mx-auto max-w-[90rem] px-5 pb-24 pt-12 md:pb-16">
        <header className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">المكتبة</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              تصفح المؤلفات والفصول في واجهة هادئة تعمل من ملفات ثابتة.
            </p>
          </div>
          <div className="self-end text-sm text-muted-foreground tabular-nums">
            {filteredBooks.length} كتاب
            {selectedCategory && <span> / {selectedCategory}</span>}
          </div>
        </header>

        <div className="grid min-w-0 gap-8 pt-8 lg:grid-cols-[17rem_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border p-3">
              <Link
                href="/library"
                className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm ${
                  !selectedCategory ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>كل الكتب</span>
                <span className="tabular-nums">{books?.length ?? ""}</span>
              </Link>
              <div className="my-3 h-px bg-border" />
              <div className="space-y-1">
                {categories?.map((category) => (
                  <Link
                    key={category.name}
                    href={`/library?category=${encodeURIComponent(category.name)}`}
                    className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm ${
                      selectedCategory === category.name
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="tabular-nums">{category.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="sticky top-16 z-30 mb-7 rounded-lg border border-border bg-background/95 px-3 py-4 backdrop-blur-xl sm:px-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث باسم الكتاب أو التصنيف"
                    className="h-12 w-full rounded-lg border border-border bg-background pr-11 pl-4 text-sm focus:border-foreground focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setView("grid")}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm ${
                      view === "grid" ? "border-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    <Grid2X2 className="h-4 w-4" />
                    بطاقات
                  </button>
                  <button
                    onClick={() => setView("list")}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm ${
                      view === "list" ? "border-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    <List className="h-4 w-4" />
                    قائمة
                  </button>
                </div>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm lg:hidden">
                <Link
                  href="/library"
                  className={`shrink-0 rounded-lg border px-3 py-2 ${
                    !selectedCategory ? "border-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  الكل
                </Link>
                {categories?.map((category) => (
                  <Link
                    key={category.name}
                    href={`/library?category=${encodeURIComponent(category.name)}`}
                    className={`shrink-0 rounded-lg border px-3 py-2 ${
                      selectedCategory === category.name ? "border-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {category.name}
                    <span className="mr-2 tabular-nums">({category.count})</span>
                  </Link>
                ))}
              </div>
            </div>

            {isLoading ? (
              <LoadingState />
            ) : isError ? (
              <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
            ) : filteredBooks.length === 0 ? (
              <EmptyState title="لا توجد نتائج" description="جرب كلمة أقصر أو أزل التصنيف المحدد." />
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBooks.map((book) => (
                  <BookCard book={book} key={book.id} progress={progressByBookId.get(book.id)} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBooks.map((book) => (
                  <BookRow book={book} key={book.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
