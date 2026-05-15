import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ChevronLeft, Layers } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { BookRow } from "@/components/editorial/BookCard";
import { EmptyState, LoadingState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import { extractBaseTitle } from "@/lib/book-titles";
import { useStaticBooks } from "@/lib/static-library";
import { useUiTranslations } from "@/lib/ui-translations";

export default function BookEditions() {
  const { t } = useUiTranslations();
  const { slug } = useParams<{ slug: string }>();
  const baseTitle = decodeURIComponent(slug ?? "");
  const { data: books, isLoading } = useStaticBooks();

  const editions = useMemo(() => {
    if (!books) return [];
    return books.filter((book) => extractBaseTitle(book.titleAr) === baseTitle);
  }, [books, baseTitle]);

  return (
    <AppShell>
      <PageFrame maxWidth="max-w-5xl">
        <Link
          href="/library"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("العودة إلى المكتبة")}
        </Link>

        <header className="border-b border-border pb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="h-4 w-4" />
            {t("الطبعات المتاحة")}
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{baseTitle}</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {isLoading ? t("جار تحميل الطبعات") : t("افتح الطبعة التي تريد القراءة منها.")}
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
      </PageFrame>
    </AppShell>
  );
}
