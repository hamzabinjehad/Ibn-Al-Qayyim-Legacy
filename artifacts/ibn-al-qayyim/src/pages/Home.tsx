import { Link, useLocation } from "wouter";
import { useGetStats, useListCategories, useListBooks } from "@workspace/api-client-react";
import { BookOpen, Search, Star, MessageSquare, PenLine, Highlighter } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  "التزكية والسلوك": "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  "السيرة والفقه": "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
  "الرقائق والحكم": "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  "العقيدة": "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200",
  "الفقه وأصوله": "bg-teal-100 text-teal-900 dark:bg-teal-900/30 dark:text-teal-200",
};

function IslamicPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="islamic" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="currentColor" strokeWidth="0.8"/>
          <polygon points="20,8 32,14 32,26 20,32 8,26 8,14" fill="none" stroke="currentColor" strokeWidth="0.5"/>
          <circle cx="20" cy="20" r="3" fill="none" stroke="currentColor" strokeWidth="0.6"/>
          <line x1="20" y1="2" x2="20" y2="8" stroke="currentColor" strokeWidth="0.4"/>
          <line x1="20" y1="32" x2="20" y2="38" stroke="currentColor" strokeWidth="0.4"/>
          <line x1="2" y1="20" x2="8" y2="20" stroke="currentColor" strokeWidth="0.4"/>
          <line x1="32" y1="20" x2="38" y2="20" stroke="currentColor" strokeWidth="0.4"/>
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#islamic)"/>
    </svg>
  );
}

export default function Home() {
  const [searchQ, setSearchQ] = useState("");
  const [, setLocation] = useLocation();

  const { data: stats } = useGetStats();
  const { data: categories } = useListCategories();
  const { data: books } = useListBooks();

  const featuredBooks = books?.slice(0, 4) ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim()) setLocation(`/search?q=${encodeURIComponent(searchQ.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground py-24 px-4">
        <IslamicPattern />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="text-sm uppercase tracking-widest opacity-70 mb-3 font-sans">مكتبة رقمية</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
            موروث ابن القيم
          </h1>
          <p className="text-lg opacity-80 mb-3">
            الإمام شمس الدين أبو عبد الله محمد بن أبي بكر بن القيم الجوزية
          </p>
          <p className="text-sm opacity-60 mb-8">٦٩١ هـ — ٧٥١ هـ</p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ابحث في كتب ابن القيم..."
              className="flex-1 px-4 py-3 rounded-lg bg-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 border border-primary-foreground/30 focus:outline-none focus:border-primary-foreground/60"
              data-testid="input-home-search"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-primary-foreground text-primary rounded-lg font-medium hover:opacity-90 transition-opacity"
              data-testid="button-home-search"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="py-10 border-b border-border bg-muted/30">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: "الكتب", value: stats.totalBooks, icon: BookOpen },
              { label: "الفصول", value: stats.totalChapters, icon: Star },
              { label: "التظليلات", value: stats.totalHighlights, icon: Highlighter },
              { label: "التعليقات", value: stats.totalComments, icon: MessageSquare },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2" data-testid={`stat-${label}`}>
                <Icon className="w-6 h-6 text-primary" />
                <p className="text-3xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="py-12 px-4 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-foreground">التصنيفات</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/library?category=${encodeURIComponent(cat.name)}`}
                className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-opacity hover:opacity-80 ${CATEGORY_COLORS[cat.name] ?? "bg-muted text-muted-foreground"}`}
                data-testid={`category-${cat.name}`}
              >
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Books */}
      <section className="py-12 px-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">من أبرز مؤلفاته</h2>
          <Link href="/library" className="text-sm text-primary hover:underline" data-testid="link-view-all-books">
            عرض الكل
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredBooks.map((book) => (
            <Link
              href={`/book/${book.id}`}
              key={book.id}
              className="group block rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`card-book-${book.id}`}
            >
              <div
                className="h-32 flex items-end p-4"
                style={{ backgroundColor: book.coverColor }}
              >
                <div className="w-full h-px bg-white/30" />
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{book.category}</p>
                <h3 className="font-bold text-foreground text-base leading-snug group-hover:text-primary transition-colors">
                  {book.titleAr}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{book.description}</p>
                <p className="text-xs text-primary mt-2">{book.chapterCount} فصل</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-14 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10 text-foreground">ميزات الموقع</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "قراءة شاملة", desc: "اقرأ جميع مؤلفات ابن القيم كاملةً بنصوصها الأصيلة" },
              { icon: Highlighter, title: "تظليل النصوص", desc: "ظلِّل ما شئت من النصوص وارجع إليها في أي وقت" },
              { icon: PenLine, title: "الملاحظات والتعليقات", desc: "أضف ملاحظاتك الخاصة وشارك في النقاش مع القراء" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border">
        <p>موروث ابن القيم &mdash; مكتبة رقمية تعليمية</p>
        <p className="mt-1 text-xs">رحمه الله رحمةً واسعة</p>
      </footer>
    </div>
  );
}
