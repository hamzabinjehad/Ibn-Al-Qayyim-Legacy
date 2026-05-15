import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BookOpen, ChevronDown, ListFilter, Search as SearchIcon } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { EmptyState, LoadingState } from "@/components/editorial/DataState";
import SearchBox from "@/components/editorial/SearchBox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useStaticBook,
  useStaticBooks,
  useStaticSearch,
  type LibrarySearchResult,
} from "@/lib/static-library";
import { matchCountText, pageText, searchResultsText, useUiTranslations } from "@/lib/ui-translations";

type SearchScope = "all" | "title" | "content";
type SearchSort = "relevance" | "book" | "page";
type SearchTarget = "library" | "book" | "section";

const SCOPE_OPTIONS: Array<{ label: string; value: SearchScope }> = [
  { label: "كل المواضع", value: "all" },
  { label: "العناوين", value: "title" },
  { label: "النصوص", value: "content" },
];

const SORT_OPTIONS: Array<{ label: string; value: SearchSort }> = [
  { label: "الأقرب صلة", value: "relevance" },
  { label: "حسب الكتاب", value: "book" },
  { label: "حسب الصفحة", value: "page" },
];

const TARGET_OPTIONS: Array<{ description: string; label: string; value: SearchTarget }> = [
  { description: "ابحث في كل كتب ابن القيم.", label: "كل المكتبة", value: "library" },
  { description: "احصر البحث في كتاب/طبعة واحدة.", label: "داخل كتاب", value: "book" },
  { description: "احصر البحث في قسم أو فصل محدد.", label: "داخل قسم", value: "section" },
];

const HARAKAT = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/;

function numberParam(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function searchStateFromParams(search: string) {
  const params = new URLSearchParams(search);
  const editionId = numberParam(params.get("editionId") ?? params.get("bookId"));
  const sectionId = numberParam(params.get("sectionId") ?? params.get("chapterId"));
  const targetParam = params.get("target");
  const scopeParam = params.get("scope");
  const sortParam = params.get("sort");
  const scope: SearchScope = scopeParam === "title" || scopeParam === "content" ? scopeParam : "all";
  const sort: SearchSort = sortParam === "book" || sortParam === "page" ? sortParam : "relevance";

  const target: SearchTarget =
    targetParam === "section" || sectionId
      ? "section"
      : targetParam === "book" || editionId
        ? "book"
        : "library";

  return {
    editionId,
    query: params.get("q") ?? "",
    scope,
    sectionId,
    sort,
    target,
  };
}

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();
}

function highlightedText(text: string, query: string): ReactNode {
  const normalizedQuery = normalizeArabic(query.trim());
  if (!normalizedQuery) return text;

  let normalizedText = "";
  const indexMap: number[] = [];

  Array.from(text).forEach((char, index) => {
    if (HARAKAT.test(char)) return;
    const normalizedChar = normalizeArabic(char);
    Array.from(normalizedChar).forEach((part) => {
      normalizedText += part;
      indexMap.push(index);
    });
  });

  const ranges: Array<[number, number]> = [];
  let searchFrom = 0;
  while (searchFrom < normalizedText.length) {
    const found = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (found === -1) break;
    const start = indexMap[found];
    const end = (indexMap[found + normalizedQuery.length - 1] ?? start) + 1;
    ranges.push([start, end]);
    searchFrom = found + normalizedQuery.length;
  }

  if (ranges.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start < cursor) return;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        className="rounded-[0.25em] bg-emerald-100 px-1 py-0.5 text-emerald-950 ring-1 ring-emerald-700/20 dark:bg-emerald-400/20 dark:text-emerald-50 dark:ring-emerald-300/25"
        key={`${start}-${end}-${index}`}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function applyFilters(results: LibrarySearchResult[] = [], scope: SearchScope, sort: SearchSort, locale: string) {
  const scoped = results.filter((result) => {
    if (scope === "title") return result.matchIn === "title" || result.matchIn === "both";
    if (scope === "content") return result.matchIn === "content" || result.matchIn === "both";
    return true;
  });

  return [...scoped].sort((a, b) => {
    if (sort === "book") {
      return (
        a.workTitle.localeCompare(b.workTitle, locale) ||
        a.bookTitle.localeCompare(b.bookTitle, locale) ||
        a.pageNumber - b.pageNumber
      );
    }
    if (sort === "page") return a.pageNumber - b.pageNumber || b.matchCount - a.matchCount;
    return b.matchCount - a.matchCount;
  });
}

function targetLabel(target: SearchTarget, t: (key: string) => string, bookTitle?: string, sectionTitle?: string) {
  if (target === "section" && sectionTitle) return `${t("داخل قسم")}: ${sectionTitle}`;
  if ((target === "book" || target === "section") && bookTitle) return `${t("داخل كتاب")}: ${bookTitle}`;
  return t("كل المكتبة");
}

export default function Search() {
  const { direction, language, sortLocale, t } = useUiTranslations();
  const search = useSearch();
  const searchState = useMemo(() => searchStateFromParams(search), [search]);

  const [query, setQuery] = useState(searchState.query);
  const [scope, setScope] = useState<SearchScope>(searchState.scope);
  const [sort, setSort] = useState<SearchSort>(searchState.sort);
  const [target, setTarget] = useState<SearchTarget>(searchState.target);
  const [selectedEditionId, setSelectedEditionId] = useState<number | undefined>(searchState.editionId);
  const [selectedSectionId, setSelectedSectionId] = useState<number | undefined>(searchState.sectionId);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    setQuery(searchState.query);
    setScope(searchState.scope);
    setSort(searchState.sort);
    setTarget(searchState.target);
    setSelectedEditionId(searchState.editionId);
    setSelectedSectionId(searchState.sectionId);
  }, [searchState]);

  const { data: books } = useStaticBooks();
  const effectiveEditionId = target === "library" ? undefined : selectedEditionId;
  const { data: selectedBook } = useStaticBook(effectiveEditionId);
  const selectedSection = selectedBook?.chapters.find((chapter) => chapter.id === selectedSectionId);

  const submittedQuery = searchState.query;
  const { data: results, isLoading } = useStaticSearch(submittedQuery, {
    bookId: effectiveEditionId,
    enabled: submittedQuery.length > 1,
    sectionId: target === "section" ? selectedSectionId : undefined,
  });
  const filteredResults = useMemo(() => applyFilters(results, scope, sort, sortLocale), [results, scope, sort, sortLocale]);

  const submit = () => {
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (scope !== "all") next.set("scope", scope);
    if (sort !== "relevance") next.set("sort", sort);
    if (target !== "library") {
      next.set("target", target);
      if (selectedEditionId) next.set("editionId", String(selectedEditionId));
      if (target === "section" && selectedSectionId) next.set("sectionId", String(selectedSectionId));
    }
    navigate(`/search?${next.toString()}`);
    setOptionsOpen(false);
  };

  const chooseEdition = (value: string) => {
    const nextEditionId = numberParam(value);
    setSelectedEditionId(nextEditionId);
    setSelectedSectionId(undefined);
  };

  return (
    <AppShell>
      <main className="scholarly-bg min-h-screen">
        <div className="mx-auto max-w-[90rem] px-3.5 pb-28 pt-7 sm:px-6 sm:pt-10 md:pb-20">
          <header className="mx-auto max-w-3xl pb-5 text-center sm:pb-7">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">{t("البحث")}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:mt-4 md:text-lg md:leading-8">
              {t("ابحث داخل كل المكتبة، أو احصر البحث في كتاب أو قسم محدد.")}
            </p>
          </header>

          <div className="reader-chrome sticky top-14 z-30 mx-auto max-w-4xl rounded-lg px-2.5 py-2.5 sm:px-4 sm:py-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <SearchBox value={query} onChange={setQuery} onSubmit={submit} placeholder="مثال: الصبر" />

              <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="reader-control inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold sm:h-12"
                    type="button"
                  >
                    <ListFilter className="h-4 w-4" />
                    {t("خيارات البحث")}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,28rem)] p-4" dir={direction}>
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold">{t("نطاق البحث")}</p>
                      <div className="mt-3 grid gap-2">
                        {TARGET_OPTIONS.map((option) => (
                          <button
                            className={`rounded-lg border p-3 text-start transition-colors ${
                              target === option.value
                                ? "border-foreground bg-muted text-foreground"
                                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                            }`}
                            key={option.value}
                            onClick={() => setTarget(option.value)}
                            type="button"
                          >
                            <span className="block text-sm font-semibold">{t(option.label)}</span>
                            <span className="mt-1 block text-xs leading-5">{t(option.description)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {target !== "library" && (
                      <label className="block text-sm font-semibold">
                        {t("الكتاب")}
                        <select
                          className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground focus:outline-none"
                          onChange={(event) => chooseEdition(event.target.value)}
                          value={selectedEditionId ?? ""}
                        >
                          <option value="">{t("اختر كتاباً")}</option>
                          {books?.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.titleAr}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {target === "section" && (
                      <label className="block text-sm font-semibold">
                        {t("القسم")}
                        <select
                          className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground focus:outline-none"
                          disabled={!selectedBook}
                          onChange={(event) => setSelectedSectionId(numberParam(event.target.value))}
                          value={selectedSectionId ?? ""}
                        >
                          <option value="">{t("اختر قسماً")}</option>
                          {selectedBook?.chapters.map((chapter) => (
                            <option key={chapter.id} value={chapter.id}>
                              {chapter.titleAr}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div>
                      <p className="text-sm font-semibold">{t("موضع المطابقة")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SCOPE_OPTIONS.map((option) => (
                          <button
                            className={`reader-control h-9 px-3 text-xs font-semibold ${
                              scope === option.value
                                ? "border-foreground bg-muted text-foreground"
                                : "text-muted-foreground"
                            }`}
                            key={option.value}
                            onClick={() => setScope(option.value)}
                            type="button"
                          >
                            {t(option.label)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block text-sm font-semibold">
                      {t("ترتيب النتائج")}
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-foreground focus:outline-none"
                        onChange={(event) => setSort(event.target.value as SearchSort)}
                        value={sort}
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      onClick={submit}
                      type="button"
                    >
                      {t("تطبيق الخيارات والبحث")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {targetLabel(target, t, selectedBook?.titleAr, selectedSection?.titleAr)}
              {scope !== "all" && ` / ${t(SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? "")}`}
              {sort !== "relevance" && ` / ${t(SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "")}`}
            </p>
          </div>

          <section className="mx-auto max-w-4xl pt-7">
            {!submittedQuery ? (
              <EmptyState
                title="ابدأ بكتابة عبارة"
                description="سيظهر لك موضع العبارة في الكتب والفصول مع مقتطف مختصر."
              />
            ) : isLoading ? (
              <LoadingState label="جار البحث" />
            ) : !results?.length ? (
              <EmptyState title="لا توجد نتائج" description="جرب عبارة أقصر أو وسّع نطاق البحث." />
            ) : filteredResults.length === 0 ? (
              <EmptyState title="لا توجد نتائج بعد الفلترة" description="غيّر نطاق البحث أو موضع المطابقة." />
            ) : (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">
                  {searchResultsText(filteredResults.length, submittedQuery, language)}
                </p>
                <div className="space-y-3">
                  {filteredResults.map((result) => (
                    <Link
                      href={`/edition/${result.editionId}/section/${result.chapterId}#page-${result.pageNumber}`}
                      className="interactive-card block p-3.5 sm:p-5"
                      key={`${result.pageId}-${result.matchCount}-${result.matchIn}`}
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-10 sm:w-10">
                          <BookOpen className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {highlightedText(result.workTitle, submittedQuery)} /{" "}
                            {highlightedText(result.bookTitle, submittedQuery)} / {pageText(result.pageNumber, language)}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold leading-7 sm:text-xl sm:leading-8">
                            {highlightedText(result.chapterTitle, submittedQuery)}
                          </h2>
                          <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">
                            {highlightedText(result.snippet, submittedQuery)}
                          </p>
                          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <SearchIcon className="h-3.5 w-3.5" />
                            {matchCountText(result.matchCount, language)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
