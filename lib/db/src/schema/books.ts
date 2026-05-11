import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  coverColor: text("cover_color").notNull().default("#8B4513"),
  pageCount: integer("page_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  content: text("content").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  level: integer("level").notNull().default(1),
  parentId: integer("parent_id").references((): AnyPgColumn => chaptersTable.id, { onDelete: "set null" }),
});

export const translationsTable = pgTable("translations", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  languageCode: text("language_code").notNull(),
  title: text("title").notNull(),
  translatorName: text("translator_name"),
  publisher: text("publisher"),
  publishYear: integer("publish_year"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true });
export const insertChapterSchema = createInsertSchema(chaptersTable).omit({ id: true });
export const insertTranslationSchema = createInsertSchema(translationsTable).omit({ id: true, createdAt: true });

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = typeof translationsTable.$inferSelect;
