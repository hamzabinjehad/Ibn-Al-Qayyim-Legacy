import { useState, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useSearchTexts } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { BookOpen, ChevronLeft, Search as SearchIcon } from "lucide-react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function Search() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialQ = params.get("q") ?? "";
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState(initialQ);
  const [submittedQ, setSubmittedQ] = useState(initialQ);

  const { data: results, isLoading } = useSearchTexts(
    { q: submittedQ },
    { query: { enabled: submittedQ.length > 1 } }
  );

  useEffect(() => {
    setSubmittedQ(initialQ);
    setQuery(initialQ);
  }, [initialQ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length > 1) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
      setSubmittedQ(query.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="reader-surface soft-panel rounded-3xl p-6 md:p-7 mb-6">
          <p className="text-sm text-primary font-semibold mb-2">بحث نصي شامل</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">ابحث داخل نصوص المؤلفات</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            اكتب عبارة من كلمتين أو أكثر للحصول على مواضعها، ثم افتح الفصل مباشرة من النتيجة.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="reader-surface soft-panel rounded-2xl p-2 flex flex-col sm:flex-row gap-2 mb-8">
          <div className="relative flex-1">
            <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثال: منزلة الصبر"
              className="w-full pr-12 pl-4 py-3 rounded-xl bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              data-testid="input-search"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={query.trim().length < 2}
            data-testid="button-search-submit"
          >
            <SearchIcon className="w-4 h-4" />
            بحث
          </button>
        </form>

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && submittedQ && results && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد نتائج للبحث عن &quot;{submittedQ}&quot;</p>
          </div>
        )}

        {results && results.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-4 flex items-center justify-between gap-3">
              <span>{results.length} نتيجة للبحث عن &quot;{submittedQ}&quot;</span>
              <Link href="/library" className="text-primary font-semibold hover:underline">تصفح المكتبة</Link>
            </p>
            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  href={`/book/${result.bookId}/chapter/${result.chapterId}`}
                  key={result.chapterId}
                  className="block soft-panel rounded-2xl bg-card/90 p-5 hover:border-primary/50 transition-all group"
                  data-testid={`result-chapter-${result.chapterId}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">{result.bookTitle}</p>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                        {result.chapterTitle}
                      </h3>
                      <p
                        className="text-sm text-muted-foreground leading-relaxed line-clamp-3"
                        dangerouslySetInnerHTML={{
                          __html: result.snippet.replace(
                            new RegExp(`(${escapeRegExp(submittedQ)})`, "gi"),
                            '<mark class="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded px-0.5">$1</mark>'
                          ),
                        }}
                      />
                      <p className="text-xs text-primary mt-3 inline-flex items-center gap-1 font-semibold">
                        {result.matchCount} تطابق
                        <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!submittedQ && (
          <div className="reader-surface soft-panel rounded-3xl text-center py-16 text-muted-foreground">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg text-foreground font-semibold">ابدأ بكتابة عبارة للبحث</p>
            <p className="text-sm mt-1">ستظهر النتائج هنا مع اسم الكتاب والفصل وعدد التطابقات.</p>
          </div>
        )}
      </div>
    </div>
  );
}
