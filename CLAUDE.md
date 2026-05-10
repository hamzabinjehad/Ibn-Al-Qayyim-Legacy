# Ibn Al-Qayyim Legacy — دليل Claude Code

## نظرة عامة

منصة ويب لتصفح وقراءة كتب ابن قيم الجوزية. تتيح للمستخدم تمييز النصوص، إضافة ملاحظات، والتعليق على الفصول. البيانات مستخرجة من Turath SDK (shamela.ws).

## بنية المشروع (pnpm monorepo)

```
artifacts/
  ibn-al-qayyim/     # واجهة React 19 + Vite 7 + Tailwind 4
  api-server/        # خادم Express 5 + Drizzle ORM
  mockup-sandbox/    # بيئة تجريبية (غير مستخدمة في الإنتاج)
lib/
  api-spec/          # OpenAPI spec + Orval codegen config
  api-client-react/  # React Query hooks (مولَّدة تلقائياً)
  api-zod/           # Zod schemas (مولَّدة تلقائياً)
  db/                # Drizzle ORM schema + PostgreSQL connection
scripts/
  src/
    extract-ibn-qayyim.ts  # يجلب بيانات الكتب من Turath SDK
    seed.ts                # يزرع قاعدة البيانات
    mock-api-server.ts     # خادم API وهمي للتطوير
```

## تدفق الكود الأساسي

```
lib/api-spec/openapi.yaml
        ↓ (pnpm --filter @workspace/api-spec run codegen)
lib/api-client-react/src/generated/   ← React Query hooks
lib/api-zod/src/generated/            ← Zod schemas
        ↓
artifacts/ibn-al-qayyim/src/          ← يستخدم الـ hooks مباشرة
artifacts/api-server/src/             ← يستخدم Zod للتحقق
```

**القاعدة:** لا تعدّل الملفات المولَّدة يدوياً. عدّل `openapi.yaml` ثم شغّل `codegen`.

## المنافذ

| الخدمة | المنفذ |
|--------|--------|
| React frontend (dev) | 5173 |
| Express API | 3001 |

الـ Vite proxy يوجّه `/api/*` تلقائياً إلى `http://localhost:3001/api/*`.

## متغيرات البيئة المطلوبة

| المتغير | القيمة الافتراضية | الاستخدام |
|---------|------------------|-----------|
| `PORT` | — | **مطلوب** لتشغيل Vite و API server |
| `BASE_PATH` | `/` | مسار الـ base لـ Vite |
| `DATABASE_URL` | — | اتصال PostgreSQL لـ Drizzle |

## أوامر التطوير

```bash
# typecheck كامل
pnpm run typecheck

# بناء كل الحزم
pnpm run build

# تشغيل API server (dev)
pnpm --filter @workspace/api-server run dev

# إعادة توليد React hooks + Zod schemas من OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# push schema قاعدة البيانات (dev فقط)
pnpm --filter @workspace/db run push

# استخراج بيانات ابن القيم من Turath SDK
pnpm --filter @workspace/scripts run extract-ibn-qayyim

# زرع قاعدة البيانات من JSON المستخرجة (يتطلب DATABASE_URL)
# يجب تشغيل push أولاً لتحديث المخطط، ثم السكريبت
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-from-extracted
```

### تشغيل الواجهة (Windows PowerShell)

```powershell
$env:PORT = "5173"; $env:BASE_PATH = "/"; Set-Location "artifacts\ibn-al-qayyim"; npx vite --host 0.0.0.0
```

## صفحات الواجهة

| المسار | الصفحة | الوصف |
|--------|--------|-------|
| `/` | Home | صفحة رئيسية مع كتب مميزة وإحصائيات |
| `/library` | Library | تصفح جميع الكتب |
| `/book/:bookId` | BookDetail | تفاصيل كتاب واحد |
| `/book/:bookId/chapter/:chapterId` | ChapterReader | قارئ الفصول (الأثقل — 880 سطر) |
| `/search` | Search | بحث نصي كامل |
| `/profile` | Profile | الملف الشخصي والإعدادات |

الـ router مبني على **Wouter** (خفيف الوزن).

## نقاط API الرئيسية

```
GET  /api/books                              ← قائمة الكتب
GET  /api/books/:id                          ← كتاب واحد
GET  /api/books/:bookId/chapters             ← فصول الكتاب
GET  /api/books/:bookId/chapters/:chapterId  ← فصل واحد
GET  /api/search                             ← بحث نصي
POST /api/annotations/highlights             ← إنشاء تمييز
POST /api/annotations/notes                  ← إنشاء ملاحظة
POST /api/annotations/comments               ← إنشاء تعليق
GET  /api/health                             ← فحص الخادم
```

## مخطط قاعدة البيانات

```
books        → id, title, titleAr, description, category, coverColor
chapters     → id, bookId (FK), title, titleAr, content, orderIndex
highlights   → id, chapterId (FK), text, color, startOffset, endOffset, sessionId
notes        → id, chapterId (FK), content, sessionId
comments     → id, chapterId (FK), content, parentId (self-ref), sessionId
```

## كيفية إضافة endpoint جديد

1. أضف المسار في `lib/api-spec/openapi.yaml`
2. شغّل `pnpm --filter @workspace/api-spec run codegen`
3. نفّذ المنطق في `artifacts/api-server/src/routes/`
4. استخدم الـ hook المولَّد في الواجهة من `@workspace/api-client-react`

## مكتبات UI

- **shadcn/ui** مبنية على Radix UI primitives — في `artifacts/ibn-al-qayyim/src/components/ui/`
- **Tailwind CSS 4** مع دعم RTL كامل (عربي)
- **Framer Motion** للحركات
- **Vaul** لـ drawer components

## ملاحظات مهمة

- المشروع يدعم **RTL كاملاً** — المحتوى العربي هو المحتوى الأساسي
- لا يوجد نظام تسجيل دخول — يُعرَّف المستخدم بـ `sessionId` في المتصفح
- `turath-sdk` يتواصل مع shamela.ws لجلب الكتب الإسلامية
- `lib/api-client-react` و `lib/api-zod` **لا تعدّلهما يدوياً** — مولَّدتان بـ Orval
