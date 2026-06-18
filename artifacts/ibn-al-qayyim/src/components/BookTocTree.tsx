import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, X } from "lucide-react";
import { DisclosureChevron } from "@/components/editorial/DirectionalIcon";
import { cn } from "@/lib/utils";
import { sectionTypeLabel, type PageDetail, type SectionSummary } from "@/lib/static-library";
import { cleanBabTitle, stripSectionTypePrefix } from "@/lib/section-title";
import { formatNumber, pageText, useUiTranslations } from "@/lib/ui-translations";
import type { LanguageCode } from "@/lib/i18n";

interface SectionNode extends SectionSummary {
  children: SectionNode[];
}

interface BookTocTreeProps {
  className?: string;
  compact?: boolean;
  currentSectionId?: number;
  defaultOpenLevel?: number;
  editionId?: number;
  editionTitle?: string;
  onSelect?: () => void;
  pages?: Pick<PageDetail, "pageNumber" | "sourcePageNumber">[];
  sections?: SectionSummary[];
  // Compatibility with the old props.
  bookId?: number;
  chapters?: Array<SectionSummary & { page?: number }>;
  currentChapterId?: number;
}

function buildTree(sections: SectionSummary[]): SectionNode[] {
  const nodeMap = new Map<number, SectionNode>();
  const roots: SectionNode[] = [];
  sections.forEach((section) => nodeMap.set(section.id, { ...section, children: [] }));
  sections.forEach((section) => {
    const node = nodeMap.get(section.id)!;
    if (section.parentId && nodeMap.has(section.parentId)) {
      nodeMap.get(section.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function collectDefaultOpenIds(nodes: SectionNode[], currentSectionId: number | undefined, defaultOpenLevel: number) {
  const openIds = new Set<number>();
  function visit(node: SectionNode, ancestors: number[], depth: number) {
    if (node.children.length > 0 && depth < defaultOpenLevel) openIds.add(node.id);
    if (node.id === currentSectionId) ancestors.forEach((id) => openIds.add(id));
    node.children.forEach((child) => visit(child, [...ancestors, node.id], depth + 1));
  }
  nodes.forEach((node) => visit(node, [], 0));
  return openIds;
}

function countDescendants(node: SectionNode): number {
  return node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

// ── Search / filter helpers ───────────────────────────────────────────────────

function normalizeForSearch(s: string): string {
  return s
    .replace(/[ً-ٟؐ-ؚۖ-ۭ]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function nodeMatchesFilter(node: SectionNode, query: string): boolean {
  if (!query) return true;
  const q = normalizeForSearch(query);
  if (normalizeForSearch(node.titleAr).includes(q)) return true;
  return node.children.some((child) => nodeMatchesFilter(child, q));
}

// Collect ids of all nodes that must be expanded to reveal filter matches
function collectFilterOpenIds(nodes: SectionNode[], query: string): Set<number> {
  const openIds = new Set<number>();
  function visit(node: SectionNode): boolean {
    const selfMatch = normalizeForSearch(node.titleAr).includes(normalizeForSearch(query));
    const childMatch = node.children.some((c) => visit(c));
    if (childMatch) openIds.add(node.id);
    return selfMatch || childMatch;
  }
  if (query) nodes.forEach(visit);
  return openIds;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookTocTree({
  bookId,
  chapters,
  className,
  compact = false,
  currentChapterId,
  currentSectionId,
  defaultOpenLevel = 1,
  editionId,
  editionTitle,
  onSelect,
  pages,
  sections,
}: BookTocTreeProps) {
  const { language, t } = useUiTranslations();
  const resolvedEditionId = editionId ?? bookId;
  const resolvedSections = sections ?? chapters ?? [];
  const resolvedCurrentId = currentSectionId ?? currentChapterId;
  const tree = useMemo(() => buildTree(resolvedSections), [resolvedSections]);

  const [filterQuery, setFilterQuery] = useState("");

  const displayPageByPageNumber = useMemo(() => {
    const pageMap = new Map<number, number>();
    pages?.forEach((page) => pageMap.set(page.pageNumber, page.sourcePageNumber ?? page.pageNumber));
    return pageMap;
  }, [pages]);

  const defaultOpenIds = useMemo(
    () => collectDefaultOpenIds(tree, resolvedCurrentId, defaultOpenLevel),
    [defaultOpenLevel, resolvedCurrentId, tree],
  );

  const filterOpenIds = useMemo(
    () => collectFilterOpenIds(tree, filterQuery),
    [tree, filterQuery],
  );

  const [openIds, setOpenIds] = useState(defaultOpenIds);
  useEffect(() => setOpenIds(defaultOpenIds), [defaultOpenIds]);
  // Auto-expand paths to filter matches
  useEffect(() => {
    if (filterQuery) setOpenIds((prev) => new Set([...prev, ...filterOpenIds]));
  }, [filterOpenIds, filterQuery]);

  const toggleNode = (nodeId: number) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const totalChildren = tree.reduce((count, node) => count + 1 + countDescendants(node), 0);
  const showFilter = resolvedSections.length >= 20;

  const filteredRoots = useMemo(
    () => (filterQuery ? tree.filter((node) => nodeMatchesFilter(node, filterQuery)) : tree),
    [tree, filterQuery],
  );

  const treeContent = (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      {showFilter && (
        <div className={cn("relative mb-2", compact && "mb-1.5")}>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={t("ابحث في الفهرس")}
            className={cn(
              "h-8 w-full rounded-md border border-border bg-background ps-8 pe-8 text-xs transition-colors focus:border-foreground focus:outline-none",
              compact && "h-7 text-[0.7rem]",
            )}
            dir="rtl"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute end-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label={t("مسح البحث")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {filteredRoots.map((node) => (
        <BookTocNode
          compact={compact}
          currentSectionId={resolvedCurrentId}
          displayPageByPageNumber={displayPageByPageNumber}
          editionId={resolvedEditionId!}
          filterQuery={filterQuery}
          key={node.id}
          language={language}
          node={node}
          onSelect={onSelect}
          openIds={openIds}
          toggleNode={toggleNode}
        />
      ))}
      {filterQuery && filteredRoots.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">{t("لا نتائج")}</p>
      )}
    </div>
  );

  return (
    <div className={cn("space-y-2", compact && "space-y-1", className)}>
      {editionTitle ? (
        <div className={cn("rounded-lg border border-border bg-background/60", compact && "rounded-md")}>
          <div className={cn("flex items-center justify-between gap-3 border-b border-border px-4 py-3", compact && "px-3 py-2")}>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("الكتاب")}</p>
              <p className={cn("line-clamp-2 font-semibold leading-7 text-foreground", compact && "text-xs leading-6")}>{editionTitle}</p>
            </div>
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{totalChildren}</span>
          </div>
          <div className={cn("p-2", compact && "p-1.5")}>
            {treeContent}
          </div>
        </div>
      ) : (
        treeContent
      )}
    </div>
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────

function BookTocNode({
  compact,
  currentSectionId,
  displayPageByPageNumber,
  editionId,
  filterQuery,
  language,
  node,
  onSelect,
  openIds,
  toggleNode,
}: {
  compact: boolean;
  currentSectionId?: number;
  displayPageByPageNumber: Map<number, number>;
  editionId: number;
  filterQuery: string;
  language: LanguageCode;
  node: SectionNode;
  onSelect?: () => void;
  openIds: Set<number>;
  toggleNode: (nodeId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCurrent = node.id === currentSectionId;
  const isOpen = openIds.has(node.id);
  const isHeading = node.type === "heading";
  const isBab = node.type === "bab";
  const isTopic = node.type === "topic" || node.type === "masala" || node.type === "faida" ||
    node.type === "qaida" || node.type === "tanbih" || node.type === "matlub" || node.type === "khatima";
  const childCount = useMemo(() => countDescendants(node), [node]);
  const href = `/edition/${editionId}/section/${node.id}`;

  const filteredChildren = useMemo(
    () =>
      filterQuery
        ? node.children.filter((c) => nodeMatchesFilter(c, filterQuery))
        : node.children,
    [node.children, filterQuery],
  );

  if (!hasChildren) {
    return (
      <Link
        href={href}
        onClick={onSelect}
        className={cn(
          // heading: centered card
          isHeading &&
            "grid grid-cols-[minmax(3.75rem,auto)_minmax(0,1fr)_minmax(3.75rem,auto)] items-center gap-3 rounded-lg border border-border bg-muted/25 px-4 py-3 text-sm leading-7 transition-colors hover:border-foreground/40 hover:bg-muted/60",
          // bab: bold with left accent
          isBab &&
            "flex items-center justify-between gap-3 rounded-lg border border-transparent border-s-2 border-s-foreground/20 bg-muted/5 px-4 py-2.5 text-sm font-medium leading-7 transition-colors hover:border-s-foreground/40 hover:bg-muted/40",
          // topic/مطلب: smaller, more muted
          isTopic &&
            "flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-1.5 text-xs leading-6 transition-colors hover:border-border/50 hover:bg-muted/30",
          // fasl: default
          !isHeading &&
            !isBab &&
            !isTopic &&
            "flex items-center justify-between gap-3 rounded-lg border border-transparent px-4 py-3 text-sm leading-7 transition-colors hover:border-border hover:bg-muted/50",
          // compact overrides
          compact &&
            (isHeading
              ? "grid-cols-[minmax(3.25rem,auto)_minmax(0,1fr)_minmax(3.25rem,auto)] px-3 py-2 text-xs leading-6"
              : isBab
                ? "px-3 py-1.5 text-xs leading-6"
                : isTopic
                  ? "px-2.5 py-1 text-[0.7rem] leading-5"
                  : "px-3 py-2 text-xs leading-6"),
          node.parentId && "ms-4",
          isCurrent ? "border-border bg-muted text-foreground" : "text-muted-foreground",
        )}
      >
        {isHeading && <span aria-hidden="true" />}
        <SectionTitle centered={isHeading} compact={compact} language={language} node={node} />
        <PageRangeLabel
          endPage={displayPageByPageNumber.get(node.endPage) ?? node.endPage}
          language={language}
          startPage={displayPageByPageNumber.get(node.startPage) ?? node.startPage}
        />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        // bab at root level gets a stronger left accent
        isBab && !node.parentId && "border-s-[3px] border-s-foreground/25",
        node.parentId && "ms-4",
        compact && "rounded-md",
      )}
    >
      <div className={cn("flex items-stretch gap-1 p-1", isCurrent && "bg-muted")}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleNode(node.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-start transition-colors hover:bg-muted/70",
            compact && "gap-2 px-2 py-1.5",
          )}
        >
          <DisclosureChevron className="h-4 w-4 shrink-0 text-muted-foreground" open={isOpen} />
          <SectionTitle
            compact={compact}
            language={language}
            node={node}
            strong={isBab || isHeading}
          />
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{childCount}</span>
        </button>
        <Link
          href={href}
          onClick={onSelect}
          className={cn(
            "inline-flex min-w-16 items-center justify-center rounded-md px-2 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isCurrent && "bg-background text-foreground",
          )}
          aria-label={`${translateReadLabel(language, node.titleAr)}`}
        >
          <PageRangeLabel
            endPage={displayPageByPageNumber.get(node.endPage) ?? node.endPage}
            language={language}
            startPage={displayPageByPageNumber.get(node.startPage) ?? node.startPage}
          />
        </Link>
      </div>
      {isOpen && (
        <div className={cn("space-y-1 border-t border-border p-2", compact && "p-1.5")}>
          {filteredChildren.map((child) => (
            <BookTocNode
              compact={compact}
              currentSectionId={currentSectionId}
              displayPageByPageNumber={displayPageByPageNumber}
              editionId={editionId}
              filterQuery={filterQuery}
              key={child.id}
              language={language}
              node={child}
              onSelect={onSelect}
              openIds={openIds}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function translateReadLabel(language: LanguageCode, title: string) {
  if (language === "de") return `${title} lesen`;
  if (language === "en") return `Read ${title}`;
  return `قراءة ${title}`;
}

function PageRangeLabel({
  endPage,
  language,
  startPage,
}: {
  endPage: number;
  language: LanguageCode;
  startPage: number;
}) {
  const pageLabel = pageText(startPage, language).replace(formatNumber(startPage, language), "").trim();
  const pageRange =
    startPage === endPage
      ? `${pageLabel} ${formatNumber(startPage, language)}`
      : `${pageLabel} ${formatNumber(startPage, language)} – ${formatNumber(endPage, language)}`;

  return (
    <span
      className="inline-flex shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground [unicode-bidi:isolate]"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {pageRange}
    </span>
  );
}

function SectionTitle({
  centered = false,
  compact,
  language,
  node,
  strong = false,
}: {
  centered?: boolean;
  compact: boolean;
  language?: LanguageCode;
  node: SectionNode;
  strong?: boolean;
}) {
  const stripped = stripSectionTypePrefix(node.titleAr, node.type);
  const displayTitle = node.type === "bab" ? cleanBabTitle(stripped) : stripped;
  const showTypeBadge = node.type !== "heading";

  return (
    <span
      className={cn(
        centered
          ? "flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 text-center leading-6"
          : "flex min-w-0 flex-1 items-baseline gap-3 leading-7",
        compact && (centered ? "gap-1 text-xs leading-5" : "gap-2 text-xs leading-6"),
        strong && "font-semibold text-foreground",
      )}
    >
      {showTypeBadge && (
        <span
          className={cn(
            "shrink-0 font-normal text-muted-foreground",
            centered
              ? "rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold"
              : node.type === "topic"
                ? "text-[0.65rem]"
                : "text-xs",
          )}
        >
          {sectionTypeLabel(node.type, language)}
        </span>
      )}
      <span className={cn("line-clamp-2 min-w-0 flex-1", centered && "w-full flex-none font-semibold text-foreground")}>
        {displayTitle}
      </span>
    </span>
  );
}
