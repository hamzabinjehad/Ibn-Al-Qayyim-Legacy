import { Router } from "express";
import { db } from "@workspace/db";
import { booksTable, chaptersTable, highlightsTable, notesTable, commentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ListBooksQueryParams,
  GetBookParams,
  ListChaptersParams,
  GetChapterParams,
} from "@workspace/api-zod";

export const booksRouter = Router();

booksRouter.get("/books", async (req, res) => {
  try {
    const { category } = ListBooksQueryParams.parse(req.query);

    const allBooks = await db.select().from(booksTable);

    const chapterCounts = await db
      .select({
        bookId: chaptersTable.bookId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(chaptersTable)
      .groupBy(chaptersTable.bookId);

    const countMap = new Map(chapterCounts.map((c) => [c.bookId, c.count]));

    let books = allBooks.map((b) => ({
      ...b,
      chapterCount: countMap.get(b.id) ?? 0,
    }));

    if (category) {
      books = books.filter((b) => b.category === category);
    }

    res.json(books);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

booksRouter.get("/books/:bookId", async (req, res) => {
  try {
    const { bookId } = GetBookParams.parse({
      bookId: parseInt(req.params.bookId),
    });

    const [book] = await db
      .select()
      .from(booksTable)
      .where(eq(booksTable.id, bookId));

    if (!book) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const [chapterCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, bookId));

    res.json({ ...book, chapterCount: chapterCount?.count ?? 0 });
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

booksRouter.get("/books/:bookId/chapters", async (req, res) => {
  try {
    const { bookId } = ListChaptersParams.parse({
      bookId: parseInt(req.params.bookId),
    });

    const chapters = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, bookId))
      .orderBy(chaptersTable.orderIndex);

    res.json(chapters);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

booksRouter.get("/chapters/:chapterId", async (req, res) => {
  try {
    const { chapterId } = GetChapterParams.parse({
      chapterId: parseInt(req.params.chapterId),
    });

    const [chapter] = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, chapterId));

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    res.json(chapter);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

booksRouter.get("/stats", async (_req, res) => {
  try {
    const [[totalBooks], [totalChapters], [totalHighlights], [totalNotes], [totalComments], categories] =
      await Promise.all([
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(booksTable),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(chaptersTable),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(highlightsTable),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(notesTable),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(commentsTable),
        db.selectDistinct({ category: booksTable.category }).from(booksTable),
      ]);

    res.json({
      totalBooks: totalBooks?.count ?? 0,
      totalChapters: totalChapters?.count ?? 0,
      totalHighlights: totalHighlights?.count ?? 0,
      totalNotes: totalNotes?.count ?? 0,
      totalComments: totalComments?.count ?? 0,
      categories: categories.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

booksRouter.get("/categories", async (_req, res) => {
  try {
    const results = await db
      .select({
        category: booksTable.category,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(booksTable)
      .groupBy(booksTable.category);

    res.json(results.map((r) => ({ name: r.category, count: r.count })));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
