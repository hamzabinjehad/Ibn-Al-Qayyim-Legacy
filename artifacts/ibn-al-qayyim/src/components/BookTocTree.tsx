import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionTypeLabel, type PageDetail, type SectionSummary } from "@/lib/static-library";
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
  function visit(node: SectionNode, ancestors: number[]) {
    if (node.children.length > 0 && node.orderIndex <= defaultOpenLevel) openIds.add(node.id);
    if (node.id === currentSectionId) ancestors.forEach((id) => openIds.add(id));
    node.children.forEach((child) => visit(child, [...ancestors, node.id]));
  }
  nodes.forEach((node) => visit(node, []));
  return openIds;
}

function countDescendants(node: SectionNode): number {
  return node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

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
  const displayPageByPageNumber = useMemo(() => {
    const pageMap = new Map<number, number>();
    pages?.forEach((page) => pageMap.set(page.pageNumber, page.sourcePageNumber ?? page.pageNumber));
    return pageMap;
  }, [pages]);
  const defaultOpenIds = useMemo(
    () => collectDefaultOpenIds(tree, resolvedCurrentId, defaultOpenLevel),
    [defaultOpenLevel, resolvedCurrentId, tree],
  );
  const [openIds, setOpenIds] = useState(defaultOpenIds);

  useEffect(() => setOpenIds(defaultOpenIds), [defaultOpenIds]);

  const toggleNode = (nodeId: number) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const totalChildren = tree.reduce((count, node) => count + 1 + countDescendants(node), 0);

  return (
    <div className={cn("space-y-2", compact && "space-y-1", className)}>
      {editionTitle && (
        <div className={cn("rounded-lg border border-border bg-background/60", compact && "rounded-md")}>
          <div className={cn("flex items-center justify-between gap-3 border-b border-border px-4 py-3", compact && "px-3 py-2")}>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("الكتاب")}</p>
              <p className={cn("line-clamp-2 font-semibold leading-7 text-foreground", compact && "text-xs leading-6")}>{editionTitle}</p>
            </div>
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{totalChildren}</span>
          </div>
          <div className={cn("space-y-2 p-2", compact && "space-y-1 p-1.5")}>
            {tree.map((node) => (
              <BookTocNode
                compact={compact}
                currentSectionId={resolvedCurrentId}
                displayPageByPageNumber={displayPageByPageNumber}
                editionId={resolvedEditionId!}
                key={node.id}
                language={language}
                node={node}
                onSelect={onSelect}
                openIds={openIds}
                toggleNode={toggleNode}
              />
            ))}
          </div>
        </div>
      )}
      {!editionTitle &&
        tree.map((node) => (
          <BookTocNode
            compact={compact}
            currentSectionId={resolvedCurrentId}
            displayPageByPageNumber={displayPageByPageNumber}
            editionId={resolvedEditionId!}
            key={node.id}
            language={language}
            node={node}
            onSelect={onSelect}
            openIds={openIds}
            toggleNode={toggleNode}
          />
        ))}
    </div>
  );
}

function BookTocNode({
  compact,
  currentSectionId,
  displayPageByPageNumber,
  editionId,
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
  language: LanguageCode;
  node: SectionNode;
  onSelect?: () => void;
  openIds: Set<number>;
  toggleNode: (nodeId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCurrent = node.id === currentSectionId;
  const isOpen = openIds.has(node.id);
  const childCount = useMemo(() => countDescendants(node), [node]);
  const href = `/edition/${editionId}/section/${node.id}`;

  if (!hasChildren) {
    return (
      <Link
        href={href}
        onClick={onSelect}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-transparent px-4 py-3 text-sm leading-7 transition-colors hover:border-border hover:bg-muted/50",
          compact && "px-3 py-2 text-xs leading-6",
          node.parentId && "mr-4 border-r-border",
          isCurrent ? "border-border bg-muted text-foreground" : "text-muted-foreground",
        )}
      >
        <SectionTitle compact={compact} language={language} node={node} />
        <PageRangeLabel
          endPage={displayPageByPageNumber.get(node.endPage) ?? node.endPage}
          language={language}
          startPage={displayPageByPageNumber.get(node.startPage) ?? node.startPage}
        />
      </Link>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border", node.parentId && "mr-4 border-r-2", compact && "rounded-md")}>
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
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen ? "rotate-0" : "rotate-90")} />
          <SectionTitle compact={compact} language={language} node={node} strong />
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
          {node.children.map((child) => (
            <BookTocNode
              compact={compact}
              currentSectionId={currentSectionId}
              displayPageByPageNumber={displayPageByPageNumber}
              editionId={editionId}
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
  compact,
  language,
  node,
  strong = false,
}: {
  compact: boolean;
  language?: LanguageCode;
  node: SectionNode;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-baseline gap-3 leading-7",
        compact && "gap-2 text-xs leading-6",
        strong && "font-semibold text-foreground",
      )}
    >
      <span className="shrink-0 text-xs font-normal text-muted-foreground">{sectionTypeLabel(node.type, language)}</span>
      <span className="line-clamp-2 min-w-0 flex-1">{node.titleAr}</span>
    </span>
  );
}
