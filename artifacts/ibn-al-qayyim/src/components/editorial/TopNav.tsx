import { Link, useLocation, useSearch } from "wouter";
import {
  Bookmark,
  Check,
  ChevronDown,
  HelpCircle,
  Library,
  Moon,
  Route,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useOnboardingTour } from "@/components/OnboardingTour";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { LANGUAGES, languageDefinition, pathForLanguage, useLanguage, type LanguageCode } from "@/lib/i18n";
import { useUiTranslations } from "@/lib/ui-translations";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  match: (path: string) => boolean;
  mobileLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/library", label: "المكتبة", icon: Library, match: (p: string) => p.startsWith("/library") || p.startsWith("/book") || p.startsWith("/editions") || p.startsWith("/work") || p.startsWith("/edition") },
  { href: "/reading-plan", label: "ترتيب القراءة", mobileLabel: "الخطة", icon: Route, match: (p: string) => p.startsWith("/reading-plan") },
  { href: "/search", label: "البحث", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/notes", label: "الملاحظات", icon: Bookmark, match: (p: string) => p.startsWith("/notes") || p.startsWith("/profile") },
];

const SITE_LOGO_SRC = `${import.meta.env.BASE_URL}site-logo.png`;

const LANGUAGE_NAMES: Record<LanguageCode, Record<LanguageCode, string>> = {
  ar: { ar: "العربية", de: "الألمانية", en: "الإنجليزية" },
  de: { ar: "Arabisch", de: "Deutsch", en: "Englisch" },
  en: { ar: "Arabic", de: "German", en: "English" },
};

function languageName(code: LanguageCode, uiLanguage: LanguageCode) {
  return LANGUAGE_NAMES[uiLanguage][code];
}

export default function TopNav() {
  const [location] = useLocation();
  const search = useSearch();
  const { language } = useLanguage();
  const { t } = useUiTranslations();
  const activeLanguage = languageDefinition(language);
  const activeLanguageName = languageName(language, language);
  const { startTour } = useOnboardingTour();
  const { dark, toggle } = useTheme();
  const visibleNavItems = language === "ar" ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/reading-plan");

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/96 shadow-[0_14px_38px_-36px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label={t("موروث ابن القيم")}
            aria-current={location === "/" ? "page" : undefined}
            className="inline-flex min-w-0 shrink-0 items-center gap-2.5 whitespace-nowrap transition-colors hover:text-muted-foreground"
          >
            <img
              src={SITE_LOGO_SRC}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full bg-black object-cover shadow-[0_10px_24px_-18px_rgba(0,0,0,0.9)] ring-1 ring-border"
            />
            <span className="hidden font-display text-lg font-bold leading-none sm:inline">
              {t("موروث ابن القيم")}
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-sm text-muted-foreground md:flex">
            {visibleNavItems.map((item) => {
              const active = item.match(location);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  href={item.href}
                  key={item.href}
                  className={`relative inline-flex h-14 items-center transition-colors hover:text-foreground ${
                    active ? "text-foreground" : ""
                  }`}
                >
                  {t(item.label)}
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t("تغيير اللغة، اللغة الحالية: {language}", { language: activeLanguageName })}
                  className="group inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-w-20"
                  dir="ltr"
                  type="button"
                >
                  <span className="text-xs font-bold uppercase leading-none text-muted-foreground">{activeLanguage.code}</span>
                  <span className="hidden max-w-24 truncate text-xs text-foreground sm:inline" dir={activeLanguage.direction}>
                    {activeLanguageName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                aria-label={t("اللغة")}
                className="w-40 rounded-md border-border bg-popover p-1 text-left shadow-sm [direction:ltr]"
                sideOffset={6}
              >
                {LANGUAGES.map((item) => {
                  const targetPath = location === "/reading-plan" && item.code !== "ar" ? "/" : location;
                  const href = `${pathForLanguage(item.code, targetPath)}${search ? `?${search}` : ""}`;
                  const active = item.code === language;
                  return (
                    <DropdownMenuItem
                      asChild
                      className={`cursor-pointer rounded-sm px-2 py-1.5 transition-colors ${
                        active ? "bg-muted text-foreground" : "text-muted-foreground focus:bg-muted/70 focus:text-foreground"
                      }`}
                      key={item.code}
                    >
                      <a
                        aria-current={active ? "page" : undefined}
                        className="grid min-h-8 grid-cols-[1.5rem_1fr_1rem] items-center gap-2"
                        href={href}
                      >
                        <span className="text-[0.65rem] font-bold uppercase text-muted-foreground">{item.code}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium leading-none" dir={item.direction}>
                            {languageName(item.code, language)}
                          </span>
                        </span>
                        <span className="flex h-4 w-4 items-center justify-center text-foreground">
                          {active && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </a>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              aria-label={t("طريقة استخدام الموقع")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
              data-tour="tour-help"
              onClick={startTour}
              type="button"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("تبديل المظهر")}
              type="button"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label={t("التنقل السفلي")}
        className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] border-t border-border bg-background/96 pb-[env(safe-area-inset-bottom)] text-[0.7rem] text-muted-foreground shadow-[0_-14px_38px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${visibleNavItems.length}, minmax(0, 1fr))` }}
      >
        {visibleNavItems.map((item) => {
          const active = item.match(location);
          const Icon = item.icon;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              href={item.href}
              key={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "font-semibold text-foreground" : "hover:text-foreground"
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-foreground" />}
              <Icon className={`h-5 w-5 ${active ? "fill-foreground/10" : ""}`} />
              <span>{t(item.mobileLabel ?? item.label)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
