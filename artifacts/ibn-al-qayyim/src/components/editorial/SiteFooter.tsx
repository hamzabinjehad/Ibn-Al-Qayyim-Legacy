import { Github } from "lucide-react";
import { Link } from "wouter";
import { CONTRIBUTION_LINKS, buildSupportUrl } from "@/lib/contribution-links";
import { useLanguage } from "@/lib/i18n";
import { useUiTranslations } from "@/lib/ui-translations";

const PRIVACY: Record<string, string> = {
  ar: "بيانات ثابتة — لا تتبع",
  de: "Statische Daten — kein Tracking",
  en: "Static data — no tracking",
};

const linkClass =
  "text-xs text-muted-foreground/70 transition-colors hover:text-foreground";

export default function SiteFooter() {
  const { language } = useLanguage();
  const { t } = useUiTranslations();

  return (
    <footer className="border-t border-border pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground/50">
          {PRIVACY[language]}
        </span>
        <nav className="flex items-center gap-4" dir="ltr">
          <Link href="/" className={linkClass}>
            {t("موروث ابن القيم")}
          </Link>
          <a href={buildSupportUrl()} target="_blank" rel="noreferrer" className={linkClass}>
            {t("الدعم")}
          </a>
          <a
            href={CONTRIBUTION_LINKS.githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className={`${linkClass} inline-flex items-center gap-1`}
          >
            <Github className="h-3 w-3" />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
