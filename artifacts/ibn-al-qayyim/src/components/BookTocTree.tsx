import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChapterSummary } from "@/lib/static-library";

interface ChapterNode extends ChapterSummary {
  children: ChapterNode[];
}

interface BookTocTreeProps {
  bookId: number;
  chapters: ChapterSummary[];
  className?: string;
  compact?: boolean;
  currentChapterId?: number;
  defaultOpenLevel?: number;
  onSelect?: () => void;
}

function buildTree(chapters: ChapterSummary[]): ChapterNode[] {
  const nodeMap = new Map<number, ChapterNode>();
  const roots: ChapterNode[] = [];

  chapters.forEach((chapter) => {
    nodeMap.set(chapter.id, { ...chapter, children: [] });
  });

  chapters.forEach((chapter) => {
    const node = nodeMap.get(chapter.id)!;
    if (chapter.parentId && nodeMap.has(chapter.parentId)) {
      nodeMap.get(chapter.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function collectDefaultOpenIds(
  nodes: ChapterNode[],
  currentChapterId: number | undefined,
  defaultOpenLevel: number,
): Set<number> {
  const openIds = new Set<number>();

  function visit(node: ChapterNode, ancestors: number[]) {
    if (node.children.length > 0 && node.level <= defaultOpenLevel) {
      openIds.add(node.id);
    }

    if (node.id === currentChapterId) {
      ancestors.forEach((id) => openIds.add(id));
    }

    node.children.forEach((child) => visit(child, [...ancestors, node.id]));
  }

  nodes.forEach((node) => visit(node, []));
  return openIds;
}

function countDescendants(node: ChapterNode): number {
  return node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

export default function BookTocTree({
  bookId,
  chapters,
  className,
  compact = false,
  currentChapterId,
  defaultOpenLevel = 1,
  onSelect,
}: BookTocTreeProps) {
  const tree = useMemo(() => buildTree(chapters), [chapters]);
  const defaultOpenIds = useMemo(
    () => collectDefaultOpenIds(tree, currentChapterId, defaultOpenLevel),
    [currentChapterId, defaultOpenLevel, tree],
  );
  const [openIds, setOpenIds] = useState(defaultOpenIds);

  useEffect(() => {
    setOpenIds(defaultOpenIds);
  }, [defaultOpenIds]);

  const toggleNode = (nodeId: number) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1", className)}>
      {tree.map((node) => (
        <BookTocNode
          bookId={bookId}
          compact={compact}
          currentChapterId={currentChapterId}
          key={node.id}
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
  bookId,
  compact,
  currentChapterId,
  node,
  onSelect,
  openIds,
  toggleNode,
}: {
  bookId: number;
  compact: boolean;
  currentChapterId?: number;
  node: ChapterNode;
  onSelect?: () => void;
  openIds: Set<number>;
  toggleNode: (nodeId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCurrent = node.id === currentChapterId;
  const isOpen = openIds.has(node.id);
  const childCount = useMemo(() => countDescendants(node), [node]);

  if (!hasChildren) {
    return (
      <Link
        href={`/book/${bookId}/chapter/${node.id}`}
        onClick={onSelect}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-transparent px-4 py-3 text-sm leading-7 transition-colors hover:border-border hover:bg-muted/50",
          compact && "px-3 py-2 text-xs leading-6",
          node.level > 1 && "mr-4 border-r-border",
          isCurrent ? "border-border bg-muted text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="line-clamp-2">{node.titleAr}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">ص {node.page}</span>
      </Link>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border", node.level > 1 && "mr-4 border-r-2", compact && "rounded-md")}>
      <div className={cn("flex items-stretch gap-1 p-1", isCurrent && "bg-muted")}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleNode(node.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-right transition-colors hover:bg-muted/70",
            compact && "gap-2 px-2 py-1.5",
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen ? "rotate-0" : "rotate-90",
            )}
          />
          <span
            className={cn(
              "line-clamp-2 flex-1 leading-7",
              node.level === 1 ? "font-semibold text-foreground" : "text-sm text-foreground",
              compact && "text-xs leading-6",
            )}
          >
            {node.titleAr}
          </span>
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
            {childCount}
          </span>
        </button>
        <Link
          href={`/book/${bookId}/chapter/${node.id}`}
          onClick={onSelect}
          className={cn(
            "inline-flex min-w-12 items-center justify-center rounded-md px-2 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isCurrent && "bg-background text-foreground",
          )}
          aria-label={`قراءة ${node.titleAr}`}
        >
          ص {node.page}
        </Link>
      </div>
      {isOpen && (
        <div className={cn("space-y-1 border-t border-border p-2", compact && "p-1.5")}>
          {node.children.map((child) => (
            <BookTocNode
              bookId={bookId}
              compact={compact}
              currentChapterId={currentChapterId}
              key={child.id}
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
