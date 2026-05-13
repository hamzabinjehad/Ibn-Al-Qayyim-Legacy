import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BookOpen, Search as SearchIcon } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { EmptyState, LoadingState } from "@/components/editorial/DataState";
import SearchBox from "@/components/editorial/SearchBox";
import { useStaticCategories, useStaticSearch } from "@/lib/static-library";

export default function Search() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialQuery = params.get("q") ?? "";
  const selectedCategory = params.get("category") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [, navigate] = useLocation();

  const submittedQuery = initialQuery;
  const { data: categories } = useStaticCategories();
  const { data: results, isLoading } = useStaticSearch(submittedQuery, {
    category: selectedCategory || undefined,
    enabled: submittedQuery.length > 1,
  });

  const submit = () => {
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (selectedCategory) next.set("category", selectedCategory);
    navigate(`/search?${next.toString()}`);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[90rem] px-5 pb-24 pt-12 md:pb-16">
        <header className="mx-auto max-w-3xl pb-8 text-center">
          <h1 className="font-display text-4xl font-bold md:text-6xl">البحث</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            ابحث داخل عناوين الكتب والفصول ومقتطفات النصوص، ثم انتقل مباشرة إلى موضع القراءة.
          </p>
        </header>

        <div className="sticky top-16 z-30 mx-auto max-w-4xl border-y border-border bg-background/95 py-4 backdrop-blur-xl md:rounded-lg md:border md:px-4">
          <SearchBox value={query} onChange={setQuery} onSubmit={submit} placeholder="مثال: الصبر" />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm">
            <Link
              href={submittedQuery ? `/search?q=${encodeURIComponent(submittedQuery)}` : "/search"}
              className={`shrink-0 rounded-lg border px-3 py-2 ${
                !selectedCategory ? "border-foreground" : "border-border text-muted-foreground"
              }`}
            >
              كل التصنيفات
            </Link>
            {categories?.map((category) => (
              <Link
                key={category.name}
                href={`/search?q=${encodeURIComponent(submittedQuery || query)}&category=${encodeURIComponent(category.name)}`}
                className={`shrink-0 rounded-lg border px-3 py-2 ${
                  selectedCategory === category.name ? "border-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <section className="mx-auto max-w-4xl pt-8">
          {!submittedQuery ? (
            <EmptyState
              title="ابدأ بكتابة عبارة"
              description="سيظهر لك موضع العبارة في الكتب والفصول مع مقتطف مختصر."
            />
          ) : isLoading ? (
            <LoadingState label="جار البحث" />
          ) : !results?.length ? (
            <EmptyState title="لا توجد نتائج" description="جرب عبارة أقصر أو ابحث في كل التصنيفات." />
          ) : (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                {results.length} نتيجة للبحث عن "{submittedQuery}"
              </p>
              <div className="space-y-3">
                {results.map((result) => (
                  <Link
                    href={`/book/${result.bookId}/chapter/${result.chapterId}`}
                    className="block rounded-lg border border-border p-5 transition-colors hover:border-foreground"
                    key={`${result.chapterId}-${result.matchCount}`}
                  >
                    <div className="flex gap-4">
                      <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {result.bookTitle} / {result.category}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold leading-8">{result.chapterTitle}</h2>
                        <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">
                          {result.snippet}
                        </p>
                        <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <SearchIcon className="h-3.5 w-3.5" />
                          {result.matchCount} تطابق
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
