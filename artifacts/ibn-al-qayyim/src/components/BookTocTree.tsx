import React, { useEffect, useMemo, useRef, useState } from "react";
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
  pages?: Pick<PageDetail, "pageNumber" | "sourcePageNumber" | "volume">[];
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

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);
  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx < 0) return text;

  // Build a map from normalized-text index → original-text index.
  // Diacritics normalize to "" (0 norm chars); all others produce 1.
  const normToOrig: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const nc = normalizeForSearch(text[i]!);
    for (let j = 0; j < nc.length; j++) normToOrig.push(i);
  }

  const origStart = normToOrig[idx] ?? text.length;
  const endNormIdx = idx + normalizedQuery.length;
  let origEnd = endNormIdx < normToOrig.length ? (normToOrig[endNormIdx] ?? text.length) : text.length;
  // Include any trailing diacritics that belong to the last matched character.
  while (origEnd < text.length && normalizeForSearch(text[origEnd]!) === "") origEnd++;

  return (
    <>
      {text.slice(0, origStart)}
      <mark className="rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-700/60">
        {text.slice(origStart, origEnd)}
      </mark>
      {text.slice(origEnd)}
    </>
  );
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resolvedCurrentId) return;
    const frame = requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>("[data-current]");
      if (!el) return;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedCurrentId]);

  const { displayPageByPageNumber, volumeByPageNumber, isMultiVolume } = useMemo(() => {
    const displayMap = new Map<number, number>();
    const volumeMap = new Map<number, number>();
    let hasReset = false;
    const volumeOrdinal = new Map<string, number>();
    let prevSrcPage = -1;
    let prevVol = "";
    pages?.forEach((page) => {
      const vol = page.volume ?? "";
      displayMap.set(page.pageNumber, page.sourcePageNumber ?? page.pageNumber);
      // Track unique volumes in order and detect page-number resets
      if (!volumeOrdinal.has(vol)) volumeOrdinal.set(vol, volumeOrdinal.size + 1);
      if (vol !== prevVol && prevVol !== "" && (page.sourcePageNumber ?? page.pageNumber) < prevSrcPage) {
        hasReset = true;
      }
      volumeMap.set(page.pageNumber, volumeOrdinal.get(vol)!);
      prevSrcPage = page.sourcePageNumber ?? page.pageNumber;
      prevVol = vol;
    });
    return { displayPageByPageNumber: displayMap, volumeByPageNumber: volumeMap, isMultiVolume: hasReset && volumeOrdinal.size > 1 };
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
    <div className="space-y-px">
      {showFilter && (
        <div className={cn("mb-2 flex items-center gap-1.5", compact && "mb-1.5")}>
          <div className={cn("relative flex-1")}>
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
          {openIds.size > 0 && !filterQuery && (
            <button
              type="button"
              onClick={() => setOpenIds(new Set())}
              className={cn(
                "shrink-0 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
                compact ? "h-7" : "h-8",
              )}
              title={t("طي الكل")}
            >
              {t("طي")}
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
          isMultiVolume={isMultiVolume}
          key={node.id}
          language={language}
          node={node}
          onSelect={onSelect}
          openIds={openIds}
          toggleNode={toggleNode}
          volumeByPageNumber={volumeByPageNumber}
        />
      ))}
      {filterQuery && filteredRoots.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">{t("لا نتائج")}</p>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn(className)}>
      {editionTitle && (
        <div
          className={cn(
            "mb-2 flex items-center justify-between gap-2 border-b border-border/50 pb-2",
            compact ? "mb-1.5 pb-1.5" : "mb-2.5 pb-2.5",
          )}
        >
          <p className={cn("truncate font-bold text-foreground", compact ? "text-xs" : "text-sm")}>
            {editionTitle}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
            {totalChildren}
          </span>
        </div>
      )}
      {treeContent}
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
  isMultiVolume,
  language,
  node,
  onSelect,
  openIds,
  toggleNode,
  volumeByPageNumber,
}: {
  compact: boolean;
  currentSectionId?: number;
  displayPageByPageNumber: Map<number, number>;
  editionId: number;
  filterQuery: string;
  isMultiVolume: boolean;
  language: LanguageCode;
  node: SectionNode;
  volumeByPageNumber: Map<number, number>;
  onSelect?: () => void;
  openIds: Set<number>;
  toggleNode: (nodeId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCurrent = node.id === currentSectionId;
  const isOpen = openIds.has(node.id);
  const isHeading = node.type === "heading";
  const isBab = node.type === "bab";
  const isTopic =
    node.type === "topic" || node.type === "masala" || node.type === "faida" ||
    node.type === "qaida" || node.type === "tanbih" || node.type === "matlub" || node.type === "khatima";
  const href = `/edition/${editionId}/section/${node.id}`;

  const filteredChildren = useMemo(
    () => filterQuery ? node.children.filter((c) => nodeMatchesFilter(c, filterQuery)) : node.children,
    [node.children, filterQuery],
  );

  const stripped = stripSectionTypePrefix(node.titleAr, node.type);
  const displayTitle = node.type === "bab" ? cleanBabTitle(stripped) : stripped;
  const typeLabel = sectionTypeLabel(node.type, language);
  const startPage = displayPageByPageNumber.get(node.startPage) ?? node.startPage;
  const endPage = displayPageByPageNumber.get(node.endPage) ?? node.endPage;
  const startVolume = isMultiVolume ? (volumeByPageNumber.get(node.startPage) ?? 1) : undefined;
  const endVolume = isMultiVolume ? (volumeByPageNumber.get(node.endPage) ?? 1) : undefined;

  // Shared row content: [type badge] [title] [page]
  const rowContent = (
    <>
      <span
        className={cn(
          "shrink-0 rounded font-normal leading-none",
          compact ? "text-[0.6rem]" : "text-[0.68rem]",
          isHeading
            ? "bg-muted px-1.5 py-0.5 text-muted-foreground"
            : "text-muted-foreground/55",
          isCurrent && !isHeading && "text-foreground/50",
        )}
      >
        {typeLabel}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 leading-6",
          isHeading
            ? cn("font-bold text-foreground", compact ? "text-xs" : "text-sm")
            : isBab
            ? cn("font-semibold", compact ? "text-xs" : "text-sm", !isCurrent && "text-foreground/85")
            : isTopic
            ? cn(compact ? "text-[0.68rem]" : "text-xs")
            : cn(compact ? "text-xs" : "text-sm"),
          isCurrent && "text-foreground",
        )}
      >
        {highlightMatch(displayTitle, filterQuery)}
      </span>
      <PageRangeLabel endPage={endPage} endVolume={endVolume} language={language} startPage={startPage} startVolume={startVolume} />
    </>
  );

  // Shared active/hover classes for the clickable row area
  const rowCls = cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-md transition-colors",
    compact ? "py-1.5 ps-2 pe-2" : "py-[0.4rem] ps-2.5 pe-2.5",
    isCurrent
      ? "border-s-2 border-s-foreground/50 bg-muted/45 text-foreground"
      : cn(
          "border-s-2 border-s-transparent",
          isHeading
            ? "text-foreground hover:bg-muted/30"
            : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
        ),
  );

  if (!hasChildren) {
    return (
      <Link
        href={href}
        onClick={onSelect}
        data-current={isCurrent || undefined}
        className={cn(rowCls, isHeading && cn("mt-2", compact && "mt-1.5"))}
      >
        {rowContent}
      </Link>
    );
  }

  return (
    <div
      data-current={isCurrent || undefined}
      className={isHeading ? cn("mt-2", compact && "mt-1.5") : undefined}
    >
      <div className="flex items-center gap-0.5">
        {/* Chevron — expand / collapse only */}
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleNode(node.id)}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md transition-colors",
            "text-muted-foreground/45 hover:bg-muted/50 hover:text-muted-foreground",
            compact ? "h-7 w-6" : "h-8 w-7",
          )}
        >
          <DisclosureChevron
            className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")}
            open={isOpen}
          />
        </button>
        {/* Clickable title → navigates to section */}
        <Link href={href} onClick={onSelect} className={rowCls}>
          {rowContent}
        </Link>
      </div>
      {isOpen && (
        <div
          className={cn(
            "mt-px space-y-px border-s border-border/45 pb-0.5",
            compact ? "ms-3 ps-2" : "ms-[0.875rem] ps-2.5",
          )}
        >
          {filteredChildren.map((child) => (
            <BookTocNode
              compact={compact}
              currentSectionId={currentSectionId}
              displayPageByPageNumber={displayPageByPageNumber}
              editionId={editionId}
              filterQuery={filterQuery}
              isMultiVolume={isMultiVolume}
              key={child.id}
              language={language}
              node={child}
              onSelect={onSelect}
              openIds={openIds}
              toggleNode={toggleNode}
              volumeByPageNumber={volumeByPageNumber}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageRangeLabel({
  endPage,
  endVolume,
  language,
  startPage,
  startVolume,
}: {
  endPage: number;
  endVolume?: number;
  language: LanguageCode;
  startPage: number;
  startVolume?: number;
}) {
  const pageLabel = pageText(startPage, language).replace(formatNumber(startPage, language), "").trim();
  const volPrefix = (vol: number) =>
    language === "de" ? `Bd.${formatNumber(vol, language)} ` :
    language !== "ar" ? `Vol.${formatNumber(vol, language)} ` :
    `ج${formatNumber(vol, language)} `;
  const sameVolume = startVolume === endVolume;
  const pageRange = startVolume
    ? (startPage === endPage
        ? `${volPrefix(startVolume)}${pageLabel} ${formatNumber(startPage, language)}`
        : sameVolume
          ? `${volPrefix(startVolume)}${pageLabel} ${formatNumber(startPage, language)} – ${formatNumber(endPage, language)}`
          : `${volPrefix(startVolume)}${pageLabel} ${formatNumber(startPage, language)} – ${volPrefix(endVolume!)}${pageLabel} ${formatNumber(endPage, language)}`)
    : (startPage === endPage
        ? `${pageLabel} ${formatNumber(startPage, language)}`
        : `${pageLabel} ${formatNumber(startPage, language)} – ${formatNumber(endPage, language)}`);

  return (
    <span
      className="inline-flex shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground [unicode-bidi:isolate]"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {pageRange}
    </span>
  );
}

