import { Link, useLocation } from "wouter";
import { Bookmark, Library, Menu, Moon, Route, Search, Settings, Sun, UserRound, type LucideIcon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  match: (path: string) => boolean;
  mobileLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/library", label: "المكتبة", icon: Library, match: (p: string) => p.startsWith("/library") || p.startsWith("/book") || p.startsWith("/editions") },
  { href: "/reading-plan", label: "ترتيب القراءة", mobileLabel: "الخطة", icon: Route, match: (p: string) => p.startsWith("/reading-plan") },
  { href: "/search", label: "البحث", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/profile", label: "الملاحظات", icon: Bookmark, match: (p: string) => p.startsWith("/profile") },
];

export default function TopNav() {
  const [location] = useLocation();
  const { dark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 max-w-[90rem] items-center gap-4 px-4 sm:px-6">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden"
          aria-label="القائمة"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link
          href="/"
          className="shrink-0 whitespace-nowrap text-lg font-semibold tracking-tight md:absolute md:left-1/2 md:-translate-x-1/2"
        >
          موروث ابن القيم
        </Link>

        <nav className="mr-auto hidden shrink-0 items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location);
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`relative inline-flex h-16 items-center transition-colors hover:text-foreground ${
                  active ? "text-foreground" : ""
                }`}
              >
                {item.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-px bg-foreground" />}
              </Link>
            );
          })}
        </nav>

        <div className="mr-auto flex items-center gap-1 md:mr-0">
          <button
            onClick={toggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
            aria-label="تبديل المظهر"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/profile"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
            aria-label="حسابي"
          >
            <UserRound className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-border bg-background/95 text-[0.7rem] text-muted-foreground backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = item.match(location);
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-foreground" : "hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "fill-foreground/10" : ""}`} />
              <span>{item.mobileLabel ?? item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={toggle}
          className="flex flex-col items-center justify-center gap-1 transition-colors hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          <span>الإعدادات</span>
        </button>
      </nav>
    </header>
  );
}
