import { Link, useSearch } from "wouter";
import { useListBooks, useListCategories } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { BookOpen } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "التزكية والسلوك": "#B45309",
  "السيرة والفقه": "#15803D",
  "الرقائق والحكم": "#1D4ED8",
  "العقيدة": "#7E22CE",
  "الفقه وأصوله": "#0F766E",
};

export default function Library() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const selectedCategory = params.get("category") ?? "";

  const { data: books, isLoading } = useListBooks(
    selectedCategory ? { category: selectedCategory } : {}
  );
  const { data: categories } = useListCategories();

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">المكتبة الكاملة</h1>
          <p className="text-muted-foreground">جميع مؤلفات الإمام ابن القيم رحمه الله</p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/library"
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${!selectedCategory ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
            data-testid="filter-all-categories"
          >
            الكل
          </Link>
          {categories?.map((cat) => (
            <Link
              href={`/library?category=${encodeURIComponent(cat.name)}`}
              key={cat.name}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${selectedCategory === cat.name ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
              data-testid={`filter-category-${cat.name}`}
            >
              {cat.name} ({cat.count})
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books?.map((book) => (
              <Link
                href={`/book/${book.id}`}
                key={book.id}
                className="group block rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`card-book-${book.id}`}
              >
                <div
                  className="h-28 relative flex items-center justify-center"
                  style={{ backgroundColor: book.coverColor }}
                >
                  <BookOpen className="w-10 h-10 text-white/60" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: CATEGORY_COLORS[book.category] ?? "#78716c" }}
                    >
                      {book.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                    {book.titleAr}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {book.description}
                  </p>
                  <p className="text-xs text-primary mt-3 font-medium">{book.chapterCount} فصل</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && books?.length === 0 && (
          <p className="text-center text-muted-foreground py-16">لا توجد كتب في هذا التصنيف</p>
        )}
      </div>
    </div>
  );
}
