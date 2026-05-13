import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Highlighter, Share2, StickyNote, Trash2 } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { EmptyState } from "@/components/editorial/DataState";
import QuoteShareModal from "@/components/QuoteShareModal";
import { getHighlightStyle } from "@/lib/highlights";
import { useLocalLibrary } from "@/lib/local-library";

interface ShareQuote {
  bookTitle: string;
  chapterTitle: string;
  text: string;
}

export default function Profile() {
  const { deleteHighlight, deleteNote, highlights, notes, positions } = useLocalLibrary();
  const [shareQuote, setShareQuote] = useState<ShareQuote | null>(null);

  return (
    <AppShell>
      <main className="mx-auto max-w-[90rem] px-5 pb-24 pt-12 md:pb-16">
        <header className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="font-display text-4xl font-bold md:text-6xl">مكتبتي</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              مواضع القراءة والتظليلات والملاحظات محفوظة محليا في هذا المتصفح.
            </p>
          </div>
          <section className="grid min-w-72 grid-cols-3 overflow-hidden rounded-lg border border-border text-center">
            <Stat label="قراءة" value={positions.length} />
            <Stat label="تظليل" value={highlights.length} />
            <Stat label="ملاحظة" value={notes.length} />
          </section>
        </header>

        <div className="grid min-w-0 gap-8 pt-10 lg:grid-cols-[22rem_1fr]">
          <aside>
            <h2 className="mb-4 text-xl font-semibold">تابع القراءة</h2>
            {positions.length === 0 ? (
              <EmptyState title="لا يوجد سجل قراءة بعد" description="ابدأ قراءة فصل وسيظهر هنا آخر موضع وصلت إليه." />
            ) : (
              <div className="space-y-3">
                {positions.map((position) => (
                  <Link
                    href={`/book/${position.bookId}/chapter/${position.chapterId}`}
                    className="block rounded-lg border border-border p-4 transition-colors hover:border-foreground"
                    key={position.chapterId}
                  >
                    <p className="text-xs text-muted-foreground">{position.bookTitle}</p>
                    <h3 className="mt-1 line-clamp-2 font-semibold leading-7">{position.chapterTitle}</h3>
                    <div className="mt-3 h-px bg-border">
                      <div className="h-px bg-foreground" style={{ width: `${Math.round(position.progress)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                      {Math.round(position.progress)}% / {new Date(position.savedAt).toLocaleDateString("ar-SA")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </aside>

          <section className="min-w-0 space-y-10">
            <SavedSection
              emptyDescription="حدد نصا في القارئ واحفظه كتظليل."
              emptyTitle="لا توجد تظليلات"
              icon={<Highlighter className="h-5 w-5" />}
              title="التظليلات"
            >
              {highlights.map((highlight) => (
                <SavedItem
                  href={`/book/${highlight.bookId}/chapter/${highlight.chapterId}`}
                  key={highlight.id}
                  meta={`${highlight.bookTitle} / ${highlight.chapterTitle}`}
                  onDelete={() => deleteHighlight(highlight.id)}
                  onShare={() =>
                    setShareQuote({
                      bookTitle: highlight.bookTitle,
                      chapterTitle: highlight.chapterTitle,
                      text: highlight.text,
                    })
                  }
                  highlightColor={highlight.color}
                  text={highlight.text}
                  variant="highlight"
                />
              ))}
            </SavedSection>

            <SavedSection
              emptyDescription="حدد نصا في القارئ وأضف ملاحظة محلية."
              emptyTitle="لا توجد ملاحظات"
              icon={<StickyNote className="h-5 w-5" />}
              title="الملاحظات"
            >
              {notes.map((note) => (
                <SavedItem
                  href={`/book/${note.bookId}/chapter/${note.chapterId}`}
                  key={note.id}
                  meta={`${note.bookTitle} / ${note.chapterTitle}`}
                  onDelete={() => deleteNote(note.id)}
                  onShare={() =>
                    setShareQuote({
                      bookTitle: note.bookTitle,
                      chapterTitle: note.chapterTitle,
                      text: note.selectedText || note.note,
                    })
                  }
                  quote={note.selectedText}
                  text={note.note}
                />
              ))}
            </SavedSection>
          </section>
        </div>
      </main>

      {shareQuote && (
        <QuoteShareModal
          bookTitle={shareQuote.bookTitle}
          chapterTitle={shareQuote.chapterTitle}
          onClose={() => setShareQuote(null)}
          text={shareQuote.text}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l border-border px-4 py-4 last:border-l-0">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SavedSection({
  children,
  emptyDescription,
  emptyTitle,
  icon,
  title,
}: {
  children: React.ReactNode[];
  emptyDescription: string;
  emptyTitle: string;
  icon: React.ReactNode;
  title: string;
}) {
  const hasItems = children.length > 0;
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        {icon}
        {title}
      </h2>
      {hasItems ? <div className="space-y-3">{children}</div> : <EmptyState title={emptyTitle} description={emptyDescription} />}
    </section>
  );
}

function SavedItem({
  href,
  meta,
  onDelete,
  highlightColor,
  onShare,
  quote,
  text,
  variant,
}: {
  href: string;
  meta: string;
  onDelete: () => void;
  highlightColor?: string;
  onShare: () => void;
  quote?: string;
  text: string;
  variant?: "highlight";
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <BookOpen className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
            {meta}
          </Link>
          {quote && <p className="saved-note-quote mt-3 text-sm leading-7">{quote}</p>}
          <p
            className={`mt-2 text-base leading-8 ${variant === "highlight" ? "reader-highlight rounded-md px-3 py-2" : ""}`}
            style={variant === "highlight" && highlightColor ? getHighlightStyle(highlightColor) : undefined}
          >
            {text}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="مشاركة"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
