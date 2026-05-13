import { Router } from "express";
import { db } from "@workspace/db";
import { booksTable, chaptersTable, highlightsTable, notesTable, commentsTable, translationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ListBooksQueryParams,
  GetBookParams,
  ListChaptersParams,
  GetChapterParams,
  ListTranslationsParams,
} from "@workspace/api-zod";

export const booksRouter = Router();

booksRouter.get("/books", async (req, res) => {
  try {
    const { category } = ListBooksQueryParams.parse(req.query);

    const books = await db
      .select({
        id: booksTable.id,
        title: booksTable.title,
        titleAr: booksTable.titleAr,
        description: booksTable.description,
        category: booksTable.category,
        coverColor: booksTable.coverColor,
        pageCount: booksTable.pageCount,
        createdAt: booksTable.createdAt,
        chapterCount: sql<number>`cast(count(${chaptersTable.id}) as int)`,
      })
      .from(booksTable)
      .leftJoin(chaptersTable, eq(booksTable.id, chaptersTable.bookId))
      .where(category ? eq(booksTable.category, category) : undefined)
      .groupBy(
        booksTable.id,
        booksTable.title,
        booksTable.titleAr,
        booksTable.description,
        booksTable.category,
        booksTable.coverColor,
        booksTable.pageCount,
        booksTable.createdAt,
      );

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
      .select({
        id: booksTable.id,
        title: booksTable.title,
        titleAr: booksTable.titleAr,
        description: booksTable.description,
        category: booksTable.category,
        coverColor: booksTable.coverColor,
        pageCount: booksTable.pageCount,
        createdAt: booksTable.createdAt,
        chapterCount: sql<number>`cast(count(${chaptersTable.id}) as int)`,
      })
      .from(booksTable)
      .leftJoin(chaptersTable, eq(booksTable.id, chaptersTable.bookId))
      .where(eq(booksTable.id, bookId))
      .groupBy(
        booksTable.id,
        booksTable.title,
        booksTable.titleAr,
        booksTable.description,
        booksTable.category,
        booksTable.coverColor,
        booksTable.pageCount,
        booksTable.createdAt,
      );

    if (!book) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    res.json(book);
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

booksRouter.get("/books/:bookId/translations", async (req, res) => {
  try {
    const { bookId } = ListTranslationsParams.parse({
      bookId: parseInt(req.params.bookId),
    });

    const [book] = await db
      .select({ id: booksTable.id })
      .from(booksTable)
      .where(eq(booksTable.id, bookId));

    if (!book) {
      res.status(404).json({ error: "Book not found" });
      return;
    }

    const translations = await db
      .select()
      .from(translationsTable)
      .where(eq(translationsTable.bookId, bookId))
      .orderBy(translationsTable.language);

    res.json(translations);
  } catch {
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
