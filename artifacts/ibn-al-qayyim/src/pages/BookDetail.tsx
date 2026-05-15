import { Link, useParams } from "wouter";
import { ArrowLeft, BookMarked, ChevronLeft, ExternalLink, Github, MessageSquareWarning, Search } from "lucide-react";
import BookTocTree from "@/components/BookTocTree";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import BookCover from "@/components/BookCover";
import { buildSourceEditUrl, buildTranslationIssueUrl } from "@/lib/contribution-links";
import { useStaticEdition } from "@/lib/static-library";
import { useUiTranslations } from "@/lib/ui-translations";

export default function BookDetail() {
  const { language, t } = useUiTranslations();
  const { editionId, bookId } = useParams<{ editionId?: string; bookId?: string }>();
  const id = Number(editionId ?? bookId);
  const { data: edition, isLoading, isError, refetch } = useStaticEdition(id);

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (isError || !edition) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl px-5 py-16">
          <ErrorState retry={() => refetch()} title="تعذر تحميل الطبعة" />
        </main>
      </AppShell>
    );
  }

  const isTranslation = edition.kind === "translation";
  const sourceEditUrl = isTranslation && edition.sourceFile ? buildSourceEditUrl(edition.sourceFile) : null;
  const correctionIssueUrl = isTranslation
    ? buildTranslationIssueUrl({
        currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
        editionId: edition.id,
        editionTitle: edition.titleAr,
        language,
        sourceFile: edition.sourceFile,
        workTitle: edition.workTitleAr,
      })
    : null;

  return (
    <AppShell>
      <PageFrame>
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/library" className="hover:text-foreground">
            {t("المكتبة")}
          </Link>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <Link href={`/work/${edition.workId}`} className="line-clamp-1 hover:text-foreground">
            {edition.workTitleAr}
          </Link>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <span className="line-clamp-1 text-foreground">{edition.titleAr}</span>
        </div>

        <section className="grid min-w-0 gap-8 border-b border-border pb-10 lg:grid-cols-[18rem_1fr]">
          <BookCover
            coverColor={edition.coverColor}
            coverImageAlt={edition.coverImageAlt}
            coverImageUrl={edition.coverImageUrl}
            editionLabel={edition.editionLabel}
            publisher={edition.publisher}
            title={edition.titleAr}
            size="lg"
            className="mx-auto w-full max-w-72"
          />
          <div className="self-center">
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{edition.titleAr}</h1>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/edition/${edition.id}/section/${edition.defaultSectionId}`}
                data-tour="book-start-reading"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                {t("ابدأ القراءة")}
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                href={`/search?target=book&editionId=${edition.id}`}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:border-foreground"
              >
                {t("البحث داخل الكتاب")}
                <Search className="h-4 w-4" />
              </Link>
              {correctionIssueUrl && (
                <a
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:border-foreground"
                  href={correctionIssueUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("اقتراح تصحيح")}
                  <MessageSquareWarning className="h-4 w-4" />
                </a>
              )}
              {sourceEditUrl && (
                <a
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:border-foreground"
                  href={sourceEditUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("تعديل ملف الترجمة على GitHub")}
                  <Github className="h-4 w-4" />
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-8 pt-10 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mb-5 flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              <h2 className="text-2xl font-semibold">{t("محتويات الطبعة")}</h2>
            </div>
            <BookTocTree editionId={edition.id} editionTitle={edition.titleAr} pages={edition.pages} sections={edition.sections} />
          </div>
        </section>
      </PageFrame>
    </AppShell>
  );
}
