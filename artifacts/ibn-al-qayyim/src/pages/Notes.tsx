import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, Download, FileText, Highlighter, Settings2, Share2, StickyNote, Trash2 } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { EmptyState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import ProgressLine from "@/components/editorial/ProgressLine";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuoteShareModal from "@/components/QuoteShareModal";
import { getHighlightStyle } from "@/lib/highlights";
import type { LanguageCode } from "@/lib/i18n";
import { type LocalHighlight, type LocalNote, useLocalLibrary } from "@/lib/local-library";
import { formatDate as formatLocalizedDate, translateUi, useUiTranslations } from "@/lib/ui-translations";

interface ShareQuote {
  bookTitle: string;
  chapterTitle: string;
  text: string;
}

interface SavedBookGroup {
  bookId: number;
  bookTitle: string;
  chapters: SavedChapterGroup[];
  highlights: LocalHighlight[];
  notes: LocalNote[];
}

interface SavedChapterGroup {
  chapterId: number;
  chapterTitle: string;
  highlights: LocalHighlight[];
  notes: LocalNote[];
}

type ExportSortMode = "newest" | "oldest" | "book";

interface DownloadOptions {
  includeBookTitle: boolean;
  includeChapterTitle: boolean;
  sortMode: ExportSortMode;
}

interface DownloadAction {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}

export default function Notes() {
  const { sortLocale, t } = useUiTranslations();
  const { deleteHighlight, deleteNote, deletePosition, highlights, notes, positions } = useLocalLibrary();
  const [shareQuote, setShareQuote] = useState<ShareQuote | null>(null);
  const savedTree = useMemo(() => buildSavedTree(highlights, notes, sortLocale), [highlights, notes, sortLocale]);

  return (
    <AppShell>
      <PageFrame containerClassName="pt-7 sm:pt-10">
        <header className="border-b border-border pb-5 sm:pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">{t("الملاحظات")}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:mt-4 md:text-lg md:leading-8">
              {t("مواضع القراءة والتظليلات والملاحظات محفوظة محليا في هذا المتصفح.")}
            </p>
          </div>
        </header>

        <div className="grid min-w-0 gap-6 pt-6 sm:pt-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:gap-8">
          <aside>
            <h2 className="mb-4 text-xl font-semibold">{t("تابع القراءة")}</h2>
            {positions.length === 0 ? (
              <EmptyState title="لا يوجد سجل قراءة بعد" description="ابدأ قراءة فصل وسيظهر هنا آخر موضع وصلت إليه." />
            ) : (
              <div className="space-y-3">
                {positions.map((position) => (
                  <ReadingPositionItem
                    key={position.chapterId}
                    onDelete={() => deletePosition(position.chapterId)}
                    position={position}
                  />
                ))}
              </div>
            )}
          </aside>

          <section className="min-w-0 space-y-10">
            <DownloadTree groups={savedTree} highlights={highlights} notes={notes} />

            <SavedSection
              emptyDescription="حدد نصا في القارئ واحفظه كتظليل."
              emptyTitle="لا توجد تظليلات"
              icon={<Highlighter className="h-5 w-5" />}
              title="التظليلات"
            >
              {highlights.map((highlight) => (
                <SavedItem
                  href={`/edition/${highlight.bookId}/section/${highlight.chapterId}`}
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
                  href={`/edition/${note.bookId}/section/${note.chapterId}`}
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
      </PageFrame>

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

function buildSavedTree(highlights: LocalHighlight[], notes: LocalNote[], locale: string) {
  const books = new Map<number, SavedBookGroup>();

  const ensureBook = (item: LocalHighlight | LocalNote) => {
    let book = books.get(item.bookId);
    if (!book) {
      book = {
        bookId: item.bookId,
        bookTitle: item.bookTitle,
        chapters: [],
        highlights: [],
        notes: [],
      };
      books.set(item.bookId, book);
    }
    return book;
  };

  const ensureChapter = (book: SavedBookGroup, item: LocalHighlight | LocalNote) => {
    let chapter = book.chapters.find((entry) => entry.chapterId === item.chapterId);
    if (!chapter) {
      chapter = {
        chapterId: item.chapterId,
        chapterTitle: item.chapterTitle,
        highlights: [],
        notes: [],
      };
      book.chapters.push(chapter);
    }
    return chapter;
  };

  highlights.forEach((highlight) => {
    const book = ensureBook(highlight);
    const chapter = ensureChapter(book, highlight);
    book.highlights.push(highlight);
    chapter.highlights.push(highlight);
  });

  notes.forEach((note) => {
    const book = ensureBook(note);
    const chapter = ensureChapter(book, note);
    book.notes.push(note);
    chapter.notes.push(note);
  });

  return Array.from(books.values())
    .map((book) => ({
      ...book,
      chapters: [...book.chapters].sort((a, b) => a.chapterId - b.chapterId),
    }))
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle, locale));
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function formatDate(value: number, language: LanguageCode) {
  return formatLocalizedDate(value, language);
}

function sortSavedItems<T extends LocalHighlight | LocalNote>(items: T[], sortMode: ExportSortMode, language: LanguageCode) {
  return [...items].sort((a, b) => {
    if (sortMode === "oldest") return a.createdAt - b.createdAt;
    if (sortMode === "book") {
      return (
        a.bookTitle.localeCompare(b.bookTitle, language === "ar" ? "ar" : language) ||
        a.chapterId - b.chapterId ||
        a.createdAt - b.createdAt
      );
    }
    return b.createdAt - a.createdAt;
  });
}

function buildSourceLines(item: LocalHighlight | LocalNote, options: DownloadOptions, language: LanguageCode) {
  const lines: string[] = [];
  if (options.includeBookTitle) lines.push(`${translateUi(language, "الكتاب")}: ${item.bookTitle}`);
  if (options.includeChapterTitle) lines.push(`${translateUi(language, "فصل")}: ${item.chapterTitle}`);
  lines.push(`${translateUi(language, "التاريخ")}: ${formatDate(item.createdAt, language)}`);
  return lines.join("\n");
}

function buildHighlightsDocument(
  highlights: LocalHighlight[],
  title: string,
  options: DownloadOptions,
  language: LanguageCode,
) {
  const body = sortSavedItems(highlights, options.sortMode, language)
    .map(
      (highlight, index) =>
        `${index + 1}. ${highlight.text}\n\n` +
        buildSourceLines(highlight, options, language),
    )
    .join("\n\n━━━━━━━━━━\n\n");

  return `${title}\n\n${body || translateUi(language, "لا توجد تظليلات.")}\n`;
}

function buildNotesDocument(notes: LocalNote[], title: string, options: DownloadOptions, language: LanguageCode) {
  const body = sortSavedItems(notes, options.sortMode, language)
    .map((note, index) => {
      const selectedText = note.selectedText ? `${translateUi(language, "النص المحدد")}:\n${note.selectedText}\n\n` : "";
      return (
        `${index + 1}. ${selectedText}` +
        `${translateUi(language, "الملاحظة")}:\n${note.note}\n\n` +
        buildSourceLines(note, options, language)
      );
    })
    .join("\n\n━━━━━━━━━━\n\n");

  return `${title}\n\n${body || translateUi(language, "لا توجد ملاحظات.")}\n`;
}

function downloadHighlights(highlights: LocalHighlight[], label: string, options: DownloadOptions, language: LanguageCode) {
  const title = translateUi(language, "تظليلات {label}", { label });
  downloadTextFile(
    buildHighlightsDocument(highlights, title, options, language),
    `${safeFilename(title)}.txt`,
  );
}

function downloadNotes(notes: LocalNote[], label: string, options: DownloadOptions, language: LanguageCode) {
  const title = translateUi(language, "ملاحظات {label}", { label });
  downloadTextFile(
    buildNotesDocument(notes, title, options, language),
    `${safeFilename(title)}.txt`,
  );
}

function DownloadTree({
  groups,
  highlights,
  notes,
}: {
  groups: SavedBookGroup[];
  highlights: LocalHighlight[];
  notes: LocalNote[];
}) {
  const { language, t } = useUiTranslations();
  const hasSavedItems = highlights.length > 0 || notes.length > 0;
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    includeBookTitle: false,
    includeChapterTitle: false,
    sortMode: "newest",
  });

  return (
    <section className="surface-card p-3.5 sm:p-4 md:p-5" data-tour="notes-downloads">
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
            <Download className="h-5 w-5" />
            {t("تحميل المحفوظات")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:leading-7">
            {t("افتح التفضيلات لاختيار ما تريد تحميله وطريقة ترتيب الملف.")}
          </p>
        </div>
        <DownloadPreferencesMenu
          actions={[
            {
              disabled: highlights.length === 0,
              icon: <Highlighter className="h-4 w-4" />,
              label: t("تحميل كل التظليلات"),
              onSelect: () => downloadHighlights(highlights, t("كل الكتب"), downloadOptions, language),
            },
            {
              disabled: notes.length === 0,
              icon: <StickyNote className="h-4 w-4" />,
              label: t("تحميل كل الملاحظات"),
              onSelect: () => downloadNotes(notes, t("كل الكتب"), downloadOptions, language),
            },
          ]}
          onOptionsChange={setDownloadOptions}
          options={downloadOptions}
        />
      </div>

      {!hasSavedItems ? (
        <EmptyState
          title="لا توجد محفوظات للتحميل"
          description="عندما تضيف تظليلاً أو ملاحظة سيظهر هنا خيار تحميلها حسب الكتاب."
        />
      ) : (
        <div>
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <details className="group py-4" key={group.bookId}>
              <summary className="flex cursor-pointer list-none items-start gap-3">
                <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-7">{group.bookTitle}</h3>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>

              <div className="mt-4 space-y-4 ps-7">
                <DownloadPreferencesMenu
                  actions={[
                    {
                      disabled: group.highlights.length === 0,
                      icon: <Highlighter className="h-4 w-4" />,
                      label: t("تحميل تظليلات الكتاب"),
                      onSelect: () => downloadHighlights(group.highlights, group.bookTitle, downloadOptions, language),
                    },
                    {
                      disabled: group.notes.length === 0,
                      icon: <StickyNote className="h-4 w-4" />,
                      label: t("تحميل ملاحظات الكتاب"),
                      onSelect: () => downloadNotes(group.notes, group.bookTitle, downloadOptions, language),
                    },
                  ]}
                  onOptionsChange={setDownloadOptions}
                  options={downloadOptions}
                  triggerLabel={t("تفضيلات تحميل الكتاب")}
                />

                <ol className="space-y-3 border-s border-border ps-4">
                  {group.chapters.map((chapter) => (
                    <li key={chapter.chapterId}>
                      <Link
                        href={`/edition/${group.bookId}/section/${chapter.chapterId}`}
                        className="font-semibold leading-7 hover:text-muted-foreground"
                      >
                        {chapter.chapterTitle}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DownloadPreferencesMenu({
  actions,
  onOptionsChange,
  options,
  triggerLabel = "تفضيلات التحميل",
}: {
  actions: DownloadAction[];
  onOptionsChange: (options: DownloadOptions) => void;
  options: DownloadOptions;
  triggerLabel?: string;
}) {
  const { direction, t } = useUiTranslations();

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground"
          type="button"
        >
          <Settings2 className="h-4 w-4" />
          {t(triggerLabel)}
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 text-start">
        <DropdownMenuLabel>{t("كيفية التحميل")}</DropdownMenuLabel>
        {actions.map((action) => (
          <DropdownMenuItem
            disabled={action.disabled}
            key={action.label}
            onSelect={action.onSelect}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("تفاصيل الملف")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={options.includeBookTitle}
          onCheckedChange={(checked) => onOptionsChange({ ...options, includeBookTitle: checked === true })}
          onSelect={(event) => event.preventDefault()}
        >
          {t("إضافة اسم الكتاب")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={options.includeChapterTitle}
          onCheckedChange={(checked) => onOptionsChange({ ...options, includeChapterTitle: checked === true })}
          onSelect={(event) => event.preventDefault()}
        >
          {t("إضافة اسم الفصل")}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("ترتيب الملف")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => onOptionsChange({ ...options, sortMode: value as ExportSortMode })}
          value={options.sortMode}
        >
          <DropdownMenuRadioItem onSelect={(event) => event.preventDefault()} value="newest">
            {t("الأحدث أولاً")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem onSelect={(event) => event.preventDefault()} value="oldest">
            {t("الأقدم أولاً")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem onSelect={(event) => event.preventDefault()} value="book">
            {t("حسب الكتاب والفصل")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReadingPositionItem({
  onDelete,
  position,
}: {
  onDelete: () => void;
  position: ReturnType<typeof useLocalLibrary>["positions"][number];
}) {
  const { formatDate, t } = useUiTranslations();

  return (
    <div className="interactive-card p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <Link href={`/edition/${position.bookId}/section/${position.chapterId}`} className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{position.bookTitle}</p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-7">{position.chapterTitle}</h3>
          <ProgressLine className="mt-3" value={position.progress} />
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {Math.round(position.progress)}% / {formatDate(position.savedAt)}
          </p>
        </Link>
        <button
          onClick={onDelete}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("حذف المقروءة")}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
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
  children: ReactNode[];
  emptyDescription: string;
  emptyTitle: string;
  icon: ReactNode;
  title: string;
}) {
  const { t } = useUiTranslations();
  const hasItems = children.length > 0;
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        {icon}
        {t(title)}
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
  const { t } = useUiTranslations();

  return (
    <div className="interactive-card p-3.5 sm:p-4">
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
        <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row">
          <button
            onClick={onShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("مشاركة")}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("حذف")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
