import { Router } from "express";
import { db } from "@workspace/db";
import { highlightsTable, notesTable, commentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
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
      return res.status(404).json({ error: "Note not found" });
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
