import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Clock, Library } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { BookCard } from "@/components/editorial/BookCard";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import SearchBox from "@/components/editorial/SearchBox";
import SectionHeader from "@/components/editorial/SectionHeader";
import { useLocalLibrary } from "@/lib/local-library";
import { useLibraryManifest, useStaticBooks, useStaticCategories } from "@/lib/static-library";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { data: manifest } = useLibraryManifest();
  const { data: books, isLoading, isError, refetch } = useStaticBooks();
  const { data: categories } = useStaticCategories();
  const { positions } = useLocalLibrary();

  const latestPosition = positions[0];
  const featuredBooks = books?.slice(0, 8) ?? [];

  return (
    <AppShell>
      <main>
        <section className="mx-auto max-w-7xl px-5 pb-12 pt-20 text-center md:pb-16 md:pt-24">
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-bold leading-[1.08] tracking-tight md:text-7xl">
            موروث ابن القيم
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            مكتبة رقمية تجمع تراث الإمام ابن القيم رحمه الله تحقيقا وتنظيما وإتاحة.
          </p>

          <div className="mx-auto mt-9 max-w-3xl">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="ابحث في الكتب والفصول..."
              onSubmit={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
            />
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/library"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              تصفح المكتبة
            </Link>
            <Link
              href="/library"
              className="inline-flex h-12 items-center gap-2 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              تصفح المجموعات
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-[90rem] px-5">
          <div className="grid overflow-hidden rounded-lg border border-border text-center sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-border">
            <Stat value={manifest?.booksCount ?? "..."} label="كتاب" />
            <Stat value={manifest?.chaptersCount ?? "..."} label="فصل" />
            <Stat value={manifest?.categoriesCount ?? "..."} label="تصنيف" />
          </div>
        </section>

        <section className="mx-auto max-w-[90rem] px-5 py-12">
          {latestPosition ? (
            <Link
              href={`/book/${latestPosition.bookId}/chapter/${latestPosition.chapterId}`}
              className="grid gap-5 rounded-lg border border-border p-5 transition-colors hover:border-foreground md:grid-cols-[auto_1fr_auto]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">تابع القراءة</p>
                <h2 className="mt-1 text-xl font-semibold">{latestPosition.chapterTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{latestPosition.bookTitle}</p>
              </div>
              <span className="self-center text-sm text-muted-foreground tabular-nums">
                {Math.round(latestPosition.progress)}%
              </span>
            </Link>
          ) : (
            <div className="rounded-lg border border-border p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">ابدأ من المكتبة</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mx-auto max-w-[90rem] px-5 py-8">
          <SectionHeader
            title="أحدث الكتب"
            description="واجهة خفيفة للقراءة والبحث تعمل من ملفات ثابتة دون خادم عام."
            action={
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-foreground"
              >
                عرض جميع الكتب
                <ArrowLeft className="h-4 w-4" />
              </Link>
            }
          />

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {featuredBooks.map((book) => (
                <BookCard book={book} key={book.id} />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-14 lg:grid-cols-[18rem_1fr]">
            <SectionHeader title="التصنيفات" description="تصفح الكتب حسب الموضوع." />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories?.map((category) => (
                <Link
                  key={category.name}
                  href={`/library?category=${encodeURIComponent(category.name)}`}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <Library className="h-4 w-4 text-muted-foreground" />
                    {category.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{category.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="py-5">
      <span className="block text-2xl font-semibold tabular-nums md:text-3xl">{value}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
