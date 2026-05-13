import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ChevronLeft, Layers } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { BookRow } from "@/components/editorial/BookCard";
import { EmptyState, LoadingState } from "@/components/editorial/DataState";
import { useStaticBooks } from "@/lib/static-library";

// Strips edition/publisher suffixes to get the base title of a work.
export function extractBaseTitle(title: string): string {
  return title
    .replace(/\s*=\s*[؀-ۿ\s،؛؟]+/, "")
    .replace(/\s*-\s*(ط|ت)\s+.+$/, "")
    .trim();
}

export default function BookEditions() {
  const { slug } = useParams<{ slug: string }>();
  const baseTitle = decodeURIComponent(slug ?? "");
  const { data: books, isLoading } = useStaticBooks();

  const editions = useMemo(() => {
    if (!books) return [];
    return books.filter((book) => extractBaseTitle(book.titleAr) === baseTitle);
  }, [books, baseTitle]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:pb-16">
        <Link
          href="/library"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          العودة إلى المكتبة
        </Link>

        <header className="border-b border-border pb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="h-4 w-4" />
            اختر الطبعة
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{baseTitle}</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {isLoading ? "جار تحميل الطبعات" : `${editions.length} طبعة متاحة تعمل من بيانات ثابتة.`}
          </p>
        </header>

        <section className="pt-8">
          {isLoading ? (
            <LoadingState />
          ) : editions.length === 0 ? (
            <EmptyState
              title="لم يعثر على هذا الكتاب"
              description="قد تكون الطبعة مدرجة بعنوان مختلف. يمكنك العودة إلى المكتبة والبحث باسم الكتاب."
            />
          ) : (
            <div className="space-y-3">
              {editions.map((book) => (
                <BookRow book={book} key={book.id} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
