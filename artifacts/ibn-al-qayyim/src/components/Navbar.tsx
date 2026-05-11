import { Link, useLocation } from "wouter";
import { BookOpen, Home, Library, Moon, Search, Sun, User } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function Navbar() {
  const [location] = useLocation();
  const { dark, toggle: toggleDark } = useTheme();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const linkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive(path)
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/88 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 min-w-0 cursor-pointer">
          <span className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-base sm:text-lg text-foreground truncate">موروث ابن القيم</span>
            <span className="hidden sm:block text-xs text-muted-foreground -mt-0.5">مكتبة قراءة وبحث وتعليق</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
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
          <Link href="/profile" className={linkClass("/profile")} data-testid="nav-profile">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">مكتبتي</span>
          </Link>
          <button
            onClick={toggleDark}
            className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shrink-0"
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
