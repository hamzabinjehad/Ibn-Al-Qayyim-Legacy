import { Link, useParams } from "wouter";
import { Layers } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { BookRow } from "@/components/editorial/BookCard";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import { DirectionalChevron } from "@/components/editorial/DirectionalIcon";
import PageFrame from "@/components/editorial/PageFrame";
import BookCover from "@/components/BookCover";
import { useStaticWork } from "@/lib/static-library";
import { useUiTranslations } from "@/lib/ui-translations";

export default function WorkDetail() {
  const { t } = useUiTranslations();
  const { workId } = useParams<{ workId: string }>();
  const id = Number(workId);
  const { data: work, isLoading, isError, refetch } = useStaticWork(id);

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (isError || !work) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl px-5 py-16">
          <ErrorState retry={() => refetch()} title="تعذر تحميل العمل" />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageFrame>
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/library" className="hover:text-foreground">
            {t("المكتبة")}
          </Link>
          <DirectionalChevron className="h-4 w-4" />
          <span className="line-clamp-1 text-foreground">{work.titleAr}</span>
        </div>

        <section className="grid min-w-0 gap-5 border-b border-border pb-7 sm:gap-7 sm:pb-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-center">
          <BookCover
            coverColor={work.coverColor}
            coverImageAlt={work.coverImageAlt}
            coverImageUrl={work.coverImageUrl}
            title={work.titleAr}
            size="lg"
            className="mx-auto !h-56 !w-40 sm:!h-72 sm:!w-48"
          />
          <div className="min-w-0 self-center">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{work.titleAr}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:mt-5 sm:leading-8">{work.description}</p>
          </div>
        </section>

        <section className="scroll-mt-24 pt-8" id="editions">
          <div className="mb-4 flex items-center gap-2 sm:mb-5">
            <Layers className="h-5 w-5" />
            <h2 className="text-xl font-semibold sm:text-2xl">{t("الطبعات المتاحة")}</h2>
          </div>
          <div className="space-y-3">
            {work.editions.map((edition) => (
              <BookRow book={edition} key={edition.id} />
            ))}
          </div>
        </section>
      </PageFrame>
    </AppShell>
  );
}
