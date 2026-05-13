import { Router } from "express";
import { db } from "@workspace/db";
import { highlightsTable, notesTable, commentsTable, chaptersTable, booksTable } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  ListHighlightsQueryParams,
  CreateHighlightBody,
  DeleteHighlightParams,
  ListNotesQueryParams,
  CreateNoteBody,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
  ListCommentsQueryParams,
  CreateCommentBody,
  DeleteCommentParams,
} from "@workspace/api-zod";

export const annotationsRouter = Router();

annotationsRouter.get("/highlights", async (req, res) => {
  try {
    const params = ListHighlightsQueryParams.parse({
      chapterId: parseInt(req.query.chapterId as string),
      sessionId: req.query.sessionId,
    });

    const conditions = [eq(highlightsTable.chapterId, params.chapterId)];
    if (params.sessionId) {
      conditions.push(eq(highlightsTable.sessionId, params.sessionId));
    }

    const highlights = await db
      .select()
      .from(highlightsTable)
      .where(and(...conditions))
      .orderBy(highlightsTable.startOffset);

    res.json(highlights);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.post("/highlights", async (req, res) => {
  try {
    const body = CreateHighlightBody.parse(req.body);
    const [highlight] = await db
      .insert(highlightsTable)
      .values(body)
      .returning();
    res.status(201).json(highlight);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.delete("/highlights/:highlightId", async (req, res) => {
  try {
    const { highlightId } = DeleteHighlightParams.parse({
      highlightId: parseInt(req.params.highlightId),
    });
    await db
      .delete(highlightsTable)
      .where(eq(highlightsTable.id, highlightId));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.get("/notes", async (req, res) => {
  try {
    const params = ListNotesQueryParams.parse({
      chapterId: parseInt(req.query.chapterId as string),
      sessionId: req.query.sessionId,
    });

    const conditions = [eq(notesTable.chapterId, params.chapterId)];
    if (params.sessionId) {
      conditions.push(eq(notesTable.sessionId, params.sessionId));
    }

    const notes = await db
      .select()
      .from(notesTable)
      .where(and(...conditions))
      .orderBy(notesTable.createdAt);

    res.json(notes);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.post("/notes", async (req, res) => {
  try {
    const body = CreateNoteBody.parse(req.body);
    const [note] = await db.insert(notesTable).values(body).returning();
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.put("/notes/:noteId", async (req, res) => {
  try {
    const { noteId } = UpdateNoteParams.parse({
      noteId: parseInt(req.params.noteId),
    });
    const body = UpdateNoteBody.parse(req.body);
    const [note] = await db
      .update(notesTable)
      .set({ content: body.content, updatedAt: new Date() })
      .where(eq(notesTable.id, noteId))
      .returning();

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.delete("/notes/:noteId", async (req, res) => {
  try {
    const { noteId } = DeleteNoteParams.parse({
      noteId: parseInt(req.params.noteId),
    });
    await db.delete(notesTable).where(eq(notesTable.id, noteId));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.get("/comments", async (req, res) => {
  try {
    const params = ListCommentsQueryParams.parse({
      chapterId: parseInt(req.query.chapterId as string),
    });

    const allComments = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.chapterId, params.chapterId))
      .orderBy(commentsTable.createdAt);

    const topLevel = allComments.filter((c) => !c.parentId);
    const replies = allComments.filter((c) => c.parentId);

    const threaded = topLevel.map((comment) => ({
      ...comment,
      replies: replies.filter((r) => r.parentId === comment.id),
    }));

    res.json(threaded);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.post("/comments", async (req, res) => {
  try {
    const body = CreateCommentBody.parse(req.body);
    const [comment] = await db
      .insert(commentsTable)
      .values(body)
      .returning();
    res.status(201).json({ ...comment, replies: [] });
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.delete("/comments/:commentId", async (req, res) => {
  try {
    const { commentId } = DeleteCommentParams.parse({
      commentId: parseInt(req.params.commentId),
    });
    await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

annotationsRouter.get("/profile/highlights", async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    const rows = await db
      .select({
        id: highlightsTable.id,
        chapterId: highlightsTable.chapterId,
        selectedText: highlightsTable.selectedText,
        color: highlightsTable.color,
        createdAt: highlightsTable.createdAt,
        chapterTitleAr: chaptersTable.titleAr,
        chapterOrder: chaptersTable.orderIndex,
        bookId: chaptersTable.bookId,
        bookTitleAr: booksTable.titleAr,
      })
      .from(highlightsTable)
      .innerJoin(chaptersTable, eq(highlightsTable.chapterId, chaptersTable.id))
      .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
      .where(eq(highlightsTable.sessionId, sessionId))
      .orderBy(desc(highlightsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

annotationsRouter.get("/profile/notes", async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    const rows = await db
      .select({
        id: notesTable.id,
        chapterId: notesTable.chapterId,
        content: notesTable.content,
        selectedText: notesTable.selectedText,
        createdAt: notesTable.createdAt,
        updatedAt: notesTable.updatedAt,
        chapterTitleAr: chaptersTable.titleAr,
        chapterOrder: chaptersTable.orderIndex,
        bookId: chaptersTable.bookId,
        bookTitleAr: booksTable.titleAr,
      })
      .from(notesTable)
      .innerJoin(chaptersTable, eq(notesTable.chapterId, chaptersTable.id))
      .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
      .where(eq(notesTable.sessionId, sessionId))
      .orderBy(desc(notesTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

annotationsRouter.get("/profile/comments", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: commentsTable.id,
        chapterId: commentsTable.chapterId,
        authorName: commentsTable.authorName,
        content: commentsTable.content,
        parentId: commentsTable.parentId,
        createdAt: commentsTable.createdAt,
        chapterTitleAr: chaptersTable.titleAr,
        bookId: chaptersTable.bookId,
        bookTitleAr: booksTable.titleAr,
      })
      .from(commentsTable)
      .innerJoin(chaptersTable, eq(commentsTable.chapterId, chaptersTable.id))
      .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
      .where(isNull(commentsTable.parentId))
      .orderBy(desc(commentsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});
