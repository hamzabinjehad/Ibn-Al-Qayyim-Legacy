import { Router } from "express";
import { db } from "@workspace/db";
import { chaptersTable, booksTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import { SearchTextsQueryParams } from "@workspace/api-zod";

export const searchRouter = Router();

searchRouter.get("/search", async (req, res) => {
  try {
    const params = SearchTextsQueryParams.parse({
      q: req.query.q,
      bookId: req.query.bookId ? parseInt(req.query.bookId as string) : undefined,
    });

    const query = `%${params.q}%`;

    const chapters = await db
      .select({
        chapterId: chaptersTable.id,
        chapterTitle: chaptersTable.titleAr,
        bookId: chaptersTable.bookId,
        bookTitle: booksTable.titleAr,
        content: chaptersTable.content,
      })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
      .where(
        params.bookId
          ? eq(chaptersTable.bookId, params.bookId)
          : ilike(chaptersTable.content, query)
      );

    const results = chapters
      .filter((c) =>
        c.content.toLowerCase().includes(params.q.toLowerCase())
      )
      .map((c) => {
        const lowerContent = c.content.toLowerCase();
        const lowerQuery = params.q.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        const start = Math.max(0, idx - 100);
        const end = Math.min(c.content.length, idx + params.q.length + 100);
        const snippet = (start > 0 ? "..." : "") + c.content.slice(start, end) + (end < c.content.length ? "..." : "");

        const matchCount = (c.content.match(new RegExp(params.q, "gi")) || []).length;

        return {
          chapterId: c.chapterId,
          chapterTitle: c.chapterTitle,
          bookId: c.bookId,
          bookTitle: c.bookTitle,
          snippet,
          matchCount,
        };
      })
      .slice(0, 20);

    res.json(results);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});
