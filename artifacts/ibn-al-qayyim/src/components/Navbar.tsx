import { Link, useLocation } from "wouter";
import { BookOpen, Search, Library, Home, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [location] = useLocation();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };

  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
      location === path
        ? "bg-primary text-primary-foreground"
        : "text-foreground/70 hover:text-foreground hover:bg-muted"
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg text-foreground">موروث ابن القيم</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/" className={linkClass("/")} data-testid="nav-home">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </Link>
          <Link href="/library" className={linkClass("/library")} data-testid="nav-library">
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">المكتبة</span>
          </Link>
          <Link href="/search" className={linkClass("/search")} data-testid="nav-search">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">البحث</span>
          </Link>
          <button
            onClick={toggleDark}
            className="p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            data-testid="toggle-dark-mode"
            aria-label="تبديل الوضع الليلي"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
