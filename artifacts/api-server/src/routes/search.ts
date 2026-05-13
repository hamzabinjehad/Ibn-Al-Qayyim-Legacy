import { Router } from "express";
import { db } from "@workspace/db";
import { chaptersTable, booksTable } from "@workspace/db";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";
import { SearchTextsQueryParams } from "@workspace/api-zod";

export const searchRouter = Router();

const SNIPPET_WINDOW = 220;

function buildSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const lowerQ = query.toLowerCase();

  // Collect up to 3 match positions
  const positions: number[] = [];
  let pos = 0;
  while (positions.length < 3) {
    const idx = lower.indexOf(lowerQ, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + 1;
  }

  if (positions.length === 0) {
    return content.slice(0, SNIPPET_WINDOW * 2);
  }

  // Build non-overlapping windows around each match
  const segments: string[] = [];
  let coveredEnd = -1;

  for (const idx of positions) {
    const start = Math.max(0, idx - SNIPPET_WINDOW);
    const end = Math.min(content.length, idx + query.length + SNIPPET_WINDOW);

    if (start < coveredEnd) {
      // Merge with previous segment
      const prev = segments.pop() ?? "";
      const prevEnd = Math.min(content.length, coveredEnd);
      const merged =
        (start > 0 && !prev.startsWith("...") ? "..." : "") +
        content.slice(Math.max(0, start - SNIPPET_WINDOW), Math.max(prevEnd, end)) +
        (Math.max(prevEnd, end) < content.length ? "..." : "");
      segments.push(merged);
      coveredEnd = Math.max(prevEnd, end);
    } else {
      segments.push(
        (start > 0 ? "..." : "") +
          content.slice(start, end) +
          (end < content.length ? "..." : "")
      );
      coveredEnd = end;
    }
  }

  return segments.join(" ◈ ");
}

searchRouter.get("/search", async (req, res) => {
  try {
    const params = SearchTextsQueryParams.parse({
      q: req.query.q,
      bookId: req.query.bookId ? parseInt(req.query.bookId as string) : undefined,
      category: req.query.category,
      sortBy: req.query.sortBy,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });

    const pageLimit = Math.min(params.limit ?? 30, 100);
    const pageOffset = params.offset ?? 0;
    const queryPattern = `%${params.q}%`;

    // Content OR title match
    const textMatch = or(
      ilike(chaptersTable.content, queryPattern),
      ilike(chaptersTable.titleAr, queryPattern)
    );

    const whereClause = and(
      params.bookId ? eq(chaptersTable.bookId, params.bookId) : undefined,
      params.category ? eq(booksTable.category, params.category) : undefined,
      textMatch
    );

    const chapters = await db
      .select({
        chapterId: chaptersTable.id,
        chapterTitle: chaptersTable.titleAr,
        bookId: chaptersTable.bookId,
        bookTitle: booksTable.titleAr,
        category: booksTable.category,
        content: chaptersTable.content,
      })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
      .where(whereClause)
      .limit(pageLimit)
      .offset(pageOffset);

    const lowerQ = params.q.toLowerCase();
    const escapedQ = params.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchRegex = new RegExp(escapedQ, "gi");

    const results = chapters.map((c) => {
      const inTitle = c.chapterTitle.toLowerCase().includes(lowerQ);
      const inContent = c.content.toLowerCase().includes(lowerQ);
      const matchIn = inTitle && inContent ? "both" : inTitle ? "title" : "content";

      const snippet = inContent
        ? buildSnippet(c.content, params.q)
        : c.content.slice(0, SNIPPET_WINDOW * 2);

      const matchCount = (c.content.match(matchRegex) || []).length + (inTitle ? 1 : 0);

      return {
        chapterId: c.chapterId,
        chapterTitle: c.chapterTitle,
        bookId: c.bookId,
        bookTitle: c.bookTitle,
        category: c.category,
        snippet,
        matchCount,
        matchIn,
      };
    });

    // Sort: relevance = highest matchCount first; book = group by bookId
    if (!params.sortBy || params.sortBy === "relevance") {
      results.sort((a, b) => b.matchCount - a.matchCount);
    } else if (params.sortBy === "book") {
      results.sort((a, b) => a.bookId - b.bookId || b.matchCount - a.matchCount);
    }

    res.json(results);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});
