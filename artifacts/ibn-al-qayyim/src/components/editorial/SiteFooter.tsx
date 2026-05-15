import { Github } from "lucide-react";
import { Link } from "wouter";
import { buildSupportUrl, CONTRIBUTION_LINKS } from "@/lib/contribution-links";
import { useUiTranslations } from "@/lib/ui-translations";

const FOOTER_COPY = {
  ar: {
    brand: "Ibn-Al-Qayyim-Legacy",
    github: "GitHub",
    localData: "الموقع يعمل ببيانات ثابتة، ومحفوظات القراءة تبقى محلياً في متصفحك.",
    navLabel: "روابط الموقع",
    support: "Support",
  },
  de: {
    brand: "Ibn-Al-Qayyim-Legacy",
    github: "GitHub",
    localData: "Die Seite nutzt statische Daten; Lesefortschritt und Notizen bleiben lokal in deinem Browser.",
    navLabel: "Footer-Links",
    support: "Support",
  },
  en: {
    brand: "Ibn-Al-Qayyim-Legacy",
    github: "GitHub",
    localData: "The site runs on static data; reading progress and notes stay local in your browser.",
    navLabel: "Footer links",
    support: "Support",
  },
} as const;

const footerLinkClass =
  "inline-flex h-9 items-center rounded-md px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function SiteFooter() {
  const { language } = useUiTranslations();
  const copy = FOOTER_COPY[language];

  return (
    <footer className="border-t border-border bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:pb-7">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-2xl leading-7">{copy.localData}</p>
        <nav
          aria-label={copy.navLabel}
          className="flex flex-wrap items-center gap-x-1 gap-y-2"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <Link className={footerLinkClass} href="/" dir="ltr">
            {copy.brand}
          </Link>
          <a className={footerLinkClass} href={buildSupportUrl()} rel="noreferrer" target="_blank">
            {copy.support}
          </a>
          <a className={`${footerLinkClass} gap-1.5`} dir="ltr" href={CONTRIBUTION_LINKS.githubRepoUrl}>
            <Github className="h-4 w-4" />
            {copy.github}
          </a>
        </nav>
      </div>
    </footer>
  );
}
