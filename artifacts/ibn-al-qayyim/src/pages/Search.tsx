import { useState, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useSearchTexts } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Search as SearchIcon, BookOpen } from "lucide-react";

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
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
      setSubmittedQ(query.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">البحث في النصوص</h1>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في كتب ابن القيم..."
            className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            data-testid="input-search"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center gap-2"
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
            <p className="text-sm text-muted-foreground mb-4">
              {results.length} نتيجة للبحث عن &quot;{submittedQ}&quot;
            </p>
            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  href={`/book/${result.bookId}/chapter/${result.chapterId}`}
                  key={result.chapterId}
                  className="block rounded-xl border border-border bg-card p-5 hover:border-primary hover:shadow-sm transition-all group"
                  data-testid={`result-chapter-${result.chapterId}`}
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">{result.bookTitle}</p>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                        {result.chapterTitle}
                      </h3>
                      <p
                        className="text-sm text-muted-foreground leading-relaxed line-clamp-3"
                        dangerouslySetInnerHTML={{
                          __html: result.snippet.replace(
                            new RegExp(`(${submittedQ})`, "gi"),
                            '<mark class="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded px-0.5">$1</mark>'
                          ),
                        }}
                      />
                      <p className="text-xs text-primary mt-2">{result.matchCount} تطابق</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!submittedQ && (
          <div className="text-center py-16 text-muted-foreground">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">ابدأ بكتابة كلمة للبحث في نصوص ابن القيم</p>
          </div>
        )}
      </div>
    </div>
  );
}
