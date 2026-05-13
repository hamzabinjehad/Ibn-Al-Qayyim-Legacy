/**
 * Local mock API server that reads extracted JSON files and serves them
 * via the same endpoints the frontend expects.
 * Run: pnpm --filter @workspace/scripts run mock-api
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const PORT = 3001;
const OUTPUT_DIR = join(process.cwd(), "output", "ibn-qayyim");

const COVER_COLORS = [
  "#5C4033", "#3B4A6B", "#2D6A4F", "#7B3F00",
  "#1B4F72", "#4A235A", "#117A65", "#6E2C00",
];

// ── Book/Chapter data ─────────────────────────────────────────────────────────
type MockBook = {
  id: number;
  title: string;
  titleAr: string;
  description: string;
  category: string;
  coverColor: string;
  createdAt: string;
  chapterCount: number;
};

type MockChapter = {
  id: number;
  bookId: number;
  title: string;
  titleAr: string;
  content: string;
  orderIndex: number;
  level: number;
  parentId: number | null;
};

let books: MockBook[] = [];
let chapters: MockChapter[] = [];

async function collectJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return collectJsonFiles(fullPath);
      if (entry.isFile() && entry.name !== "index.json" && entry.name.endsWith(".json")) return [fullPath];
      return [];
    }),
  );

  return files.flat();
}

function collectPages(data: unknown): Array<{ text: string; page?: number }> {
  const pages: Array<{ text: string; page?: number }> = [];

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      if (value.some((item) => item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string")) {
        for (const item of value) {
          if (!item || typeof item !== "object") continue;
          const page = item as { page?: unknown; text?: unknown };
          if (typeof page.text === "string") {
            pages.push({
              page: typeof page.page === "number" ? page.page : undefined,
              text: page.text,
            });
          }
        }
        return;
      }

      for (const item of value) visit(item);
      return;
    }

    if (!value || typeof value !== "object") return;
    for (const child of Object.values(value)) visit(child);
  };

  visit(data);
  return pages;
}

async function loadData() {
  try {
    const jsonFiles = await collectJsonFiles(OUTPUT_DIR);

    let bookId = 1;
    let chapterId = 1;

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(file, "utf-8");
        const data = JSON.parse(raw);

        const coverColor = COVER_COLORS[(bookId - 1) % COVER_COLORS.length]!;
        const pages = collectPages(data);
        const chapterCount = pages.length;
        const title = typeof data.title === "string" ? data.title : basename(file, ".json");
        const category = typeof data.category === "string" ? data.category : basename(dirname(file));

        books.push({
          id: bookId,
          title,
          titleAr: title,
          description: data.index?.[0]?.title ?? "كتاب من تراث الإمام ابن القيم",
          category,
          coverColor,
          createdAt: data.extracted_at,
          chapterCount,
        });

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]!;
          const chapterTitle = `ØµÙØ­Ø© ${page.page ?? i + 1}`;
          chapters.push({
            id: chapterId++,
            bookId,
            title: chapterTitle,
            titleAr: chapterTitle,
            content: page.text.slice(0, 50000),
            orderIndex: i,
            level: 1,
            parentId: null,
          });
        }

        if (chapterCount === 0 && data.pages?.length) {
          const content = data.pages.slice(0, 20).map((p: any) => p.text).join("\n\n");
          chapters.push({
            id: chapterId++,
            bookId,
            title: data.title,
            titleAr: data.title,
            content: content.slice(0, 50000),
            orderIndex: 0,
            level: 1,
            parentId: null,
          });
        }

        bookId++;
      } catch {
        // skip malformed files
      }
    }

    console.log(`✅ Loaded ${books.length} books, ${chapters.length} chapters`);
  } catch (err) {
    console.warn("⚠️  No extracted books found yet, serving empty data");
  }
}

function guessCategory(title: string): string {
  if (/صلاة|وضوء|صيام|حج|زكاة/.test(title)) return "الفقه وأصوله";
  if (/قرآن|تفسير/.test(title)) return "علوم القرآن";
  if (/روح|قلب|زهد|تزكية|سلوك|صابر|شاكر|محب/.test(title)) return "التزكية والسلوك";
  if (/عقيدة|توحيد|أسماء|صفات|جهمية/.test(title)) return "العقيدة";
  if (/سيرة|هدي|زاد/.test(title)) return "السيرة والفقه";
  return "الرقائق والحكم";
}

// ── Annotation stores ─────────────────────────────────────────────────────────
type StoredHighlight = {
  id: number;
  chapterId: number;
  sessionId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: string;
};

type StoredNote = {
  id: number;
  chapterId: number;
  sessionId: string;
  content: string;
  selectedText?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredComment = {
  id: number;
  chapterId: number;
  authorName: string;
  content: string;
  parentId?: number | null;
  createdAt: string;
};

const annHighlights: StoredHighlight[] = [];
const annNotes: StoredNote[] = [];
const annComments: StoredComment[] = [];
let nextHlId = 1;
let nextNoteId = 1;
let nextCommentId = 1;

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function json(res: ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function noContent(res: ServerResponse) {
  res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
  res.end();
}

function notFound(res: ServerResponse) {
  json(res, { error: "Not found" }, 404);
}

// ── Router ────────────────────────────────────────────────────────────────────
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname
      .replace(/^\/api/, "")
      .replace(/^\/annotations(?=\/(?:highlights|notes|comments|profile)(?:\/|$))/, "");
    const method = req.method ?? "GET";

    // CORS preflight
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    // GET /healthz
    if (path === "/healthz") return json(res, { status: "ok" });

    // GET /stats
    if (path === "/stats") {
      return json(res, {
        totalBooks: books.length,
        totalChapters: chapters.length,
        totalHighlights: annHighlights.length,
        totalNotes: annNotes.length,
        totalComments: annComments.length,
        categories: new Set(books.map((b) => b.category)).size,
      });
    }

    // GET /categories
    if (path === "/categories") {
      const counts = new Map<string, number>();
      for (const b of books) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
      return json(res, Array.from(counts.entries()).map(([name, count]) => ({ name, count })));
    }

    // GET /books
    if (method === "GET" && path === "/books") {
      const category = url.searchParams.get("category");
      const result = category ? books.filter((b) => b.category === category) : books;
      return json(res, result);
    }

    // GET /books/:id
    const bookMatch = path.match(/^\/books\/(\d+)$/);
    if (method === "GET" && bookMatch) {
      const book = books.find((b) => b.id === Number(bookMatch[1]));
      return book ? json(res, book) : notFound(res);
    }

    // GET /books/:id/chapters
    const chaptersMatch = path.match(/^\/books\/(\d+)\/chapters$/);
    if (method === "GET" && chaptersMatch) {
      const bookId = Number(chaptersMatch[1]);
      return json(res, chapters.filter((c) => c.bookId === bookId));
    }

    // GET /chapters/:id
    const chapterMatch = path.match(/^\/chapters\/(\d+)$/);
    if (method === "GET" && chapterMatch) {
      const chapter = chapters.find((c) => c.id === Number(chapterMatch[1]));
      return chapter ? json(res, chapter) : notFound(res);
    }

    // GET /search
    if (method === "GET" && path === "/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const bookId = url.searchParams.get("bookId");
      let pool = chapters;
      if (bookId) pool = pool.filter((c) => c.bookId === Number(bookId));
      const results = pool
        .filter((c) => c.titleAr.toLowerCase().includes(q) || c.content.toLowerCase().includes(q))
        .slice(0, 20)
        .map((c) => {
          const book = books.find((b) => b.id === c.bookId);
          const idx = c.content.toLowerCase().indexOf(q);
          const snippet = idx >= 0
            ? c.content.slice(Math.max(0, idx - 60), idx + 140)
            : c.content.slice(0, 200);
          return {
            chapterId: c.id,
            chapterTitle: c.titleAr,
            bookId: c.bookId,
            bookTitle: book?.titleAr ?? "",
            snippet,
            matchCount: 1,
          };
        });
      return json(res, results);
    }

    // ── Annotations ───────────────────────────────────────────────────────────

    // GET /highlights
    if (method === "GET" && path === "/highlights") {
      const chapterId = parseInt(url.searchParams.get("chapterId") ?? "0");
      const sessionId = url.searchParams.get("sessionId");
      const result = annHighlights.filter(
        (h) => h.chapterId === chapterId && (!sessionId || h.sessionId === sessionId)
      );
      return json(res, result);
    }

    // POST /highlights
    if (method === "POST" && path === "/highlights") {
      const body = await readBody(req);
      const hl: StoredHighlight = {
        id: nextHlId++,
        chapterId: body.chapterId as number,
        sessionId: body.sessionId as string,
        selectedText: body.selectedText as string,
        startOffset: body.startOffset as number,
        endOffset: body.endOffset as number,
        color: body.color as string,
        createdAt: new Date().toISOString(),
      };
      annHighlights.push(hl);
      return json(res, hl, 201);
    }

    // DELETE /highlights/:id
    const hlIdMatch = path.match(/^\/highlights\/(\d+)$/);
    if (method === "DELETE" && hlIdMatch) {
      const id = parseInt(hlIdMatch[1]);
      const idx = annHighlights.findIndex((h) => h.id === id);
      if (idx !== -1) annHighlights.splice(idx, 1);
      return noContent(res);
    }

    // GET /notes
    if (method === "GET" && path === "/notes") {
      const chapterId = parseInt(url.searchParams.get("chapterId") ?? "0");
      const sessionId = url.searchParams.get("sessionId");
      const result = annNotes.filter(
        (n) => n.chapterId === chapterId && (!sessionId || n.sessionId === sessionId)
      );
      return json(res, result);
    }

    // POST /notes
    if (method === "POST" && path === "/notes") {
      const body = await readBody(req);
      const note: StoredNote = {
        id: nextNoteId++,
        chapterId: body.chapterId as number,
        sessionId: body.sessionId as string,
        content: body.content as string,
        selectedText: body.selectedText as string | undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      annNotes.push(note);
      return json(res, note, 201);
    }

    // PUT or DELETE /notes/:id
    const noteIdMatch = path.match(/^\/notes\/(\d+)$/);
    if (noteIdMatch) {
      const id = parseInt(noteIdMatch[1]);
      if (method === "PUT") {
        const body = await readBody(req);
        const note = annNotes.find((n) => n.id === id);
        if (!note) return notFound(res);
        note.content = body.content as string;
        note.updatedAt = new Date().toISOString();
        return json(res, note);
      }
      if (method === "DELETE") {
        const idx = annNotes.findIndex((n) => n.id === id);
        if (idx !== -1) annNotes.splice(idx, 1);
        return noContent(res);
      }
    }

    // GET /comments
    if (method === "GET" && path === "/comments") {
      const chapterId = parseInt(url.searchParams.get("chapterId") ?? "0");
      const topLevel = annComments.filter((c) => c.chapterId === chapterId && !c.parentId);
      const replies = annComments.filter((c) => c.chapterId === chapterId && c.parentId);
      const threaded = topLevel.map((c) => ({
        ...c,
        replies: replies.filter((r) => r.parentId === c.id),
      }));
      return json(res, threaded);
    }

    // POST /comments
    if (method === "POST" && path === "/comments") {
      const body = await readBody(req);
      const comment: StoredComment = {
        id: nextCommentId++,
        chapterId: body.chapterId as number,
        authorName: body.authorName as string,
        content: body.content as string,
        parentId: (body.parentId as number | null | undefined) ?? null,
        createdAt: new Date().toISOString(),
      };
      annComments.push(comment);
      return json(res, { ...comment, replies: [] }, 201);
    }

    // DELETE /comments/:id
    const commentIdMatch = path.match(/^\/comments\/(\d+)$/);
    if (method === "DELETE" && commentIdMatch) {
      const id = parseInt(commentIdMatch[1]);
      const idx = annComments.findIndex((c) => c.id === id);
      if (idx !== -1) annComments.splice(idx, 1);
      return noContent(res);
    }

    // GET /profile/highlights
    if (method === "GET" && path === "/profile/highlights") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return json(res, { error: "sessionId required" }, 400);
      const result = annHighlights
        .filter((h) => h.sessionId === sessionId)
        .map((h) => {
          const chapter = chapters.find((c) => c.id === h.chapterId);
          const book = chapter ? books.find((b) => b.id === chapter.bookId) : undefined;
          return {
            ...h,
            chapterTitleAr: chapter?.titleAr ?? "",
            bookId: chapter?.bookId ?? 0,
            bookTitleAr: book?.titleAr ?? "",
          };
        });
      return json(res, result);
    }

    // GET /profile/notes
    if (method === "GET" && path === "/profile/notes") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return json(res, { error: "sessionId required" }, 400);
      const result = annNotes
        .filter((n) => n.sessionId === sessionId)
        .map((n) => {
          const chapter = chapters.find((c) => c.id === n.chapterId);
          const book = chapter ? books.find((b) => b.id === chapter.bookId) : undefined;
          return {
            ...n,
            chapterTitleAr: chapter?.titleAr ?? "",
            bookId: chapter?.bookId ?? 0,
            bookTitleAr: book?.titleAr ?? "",
          };
        });
      return json(res, result);
    }

    // GET /profile/comments
    if (method === "GET" && path === "/profile/comments") {
      const result = annComments
        .filter((c) => !c.parentId)
        .map((c) => {
          const chapter = chapters.find((ch) => ch.id === c.chapterId);
          const book = chapter ? books.find((b) => b.id === chapter.bookId) : undefined;
          return {
            ...c,
            chapterTitleAr: chapter?.titleAr ?? "",
            bookId: chapter?.bookId ?? 0,
            bookTitleAr: book?.titleAr ?? "",
          };
        });
      return json(res, result);
    }

    notFound(res);
  } catch (err) {
    console.error("Server error:", err);
    json(res, { error: "Internal server error" }, 500);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
await loadData();

const server = createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`🟢 Mock API running on http://localhost:${PORT}`);
  console.log(`   Books: ${books.length} | Chapters: ${chapters.length}`);
});
