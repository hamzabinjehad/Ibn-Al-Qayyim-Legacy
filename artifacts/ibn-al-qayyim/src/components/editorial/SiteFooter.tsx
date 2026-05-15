import { Github } from "lucide-react";
import { Link } from "wouter";
import { CONTRIBUTION_LINKS } from "@/lib/contribution-links";
import { useUiTranslations } from "@/lib/ui-translations";

const FOOTER_COPY = {
  ar: {
    github: "GitHub",
    library: "المكتبة",
    localData: "الموقع يعمل ببيانات ثابتة، ومحفوظات القراءة تبقى محلياً في متصفحك.",
    support: "الدعم",
  },
  de: {
    github: "GitHub",
    library: "Bibliothek",
    localData: "Die Seite nutzt statische Daten; Lesefortschritt und Notizen bleiben lokal in deinem Browser.",
    support: "Unterstützen",
  },
  en: {
    github: "GitHub",
    library: "Library",
    localData: "The site runs on static data; reading progress and notes stay local in your browser.",
    support: "Support",
  },
} as const;

export default function SiteFooter() {
  const { language } = useUiTranslations();
  const copy = FOOTER_COPY[language];

  return (
    <footer className="border-t border-border bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:pb-7">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-2xl leading-7">{copy.localData}</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={copy.support}>
          <Link className="transition-colors hover:text-foreground" href="/library">
            {copy.library}
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/support">
            {copy.support}
          </Link>
          <a
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            href={CONTRIBUTION_LINKS.githubRepoUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Github className="h-4 w-4" />
            {copy.github}
          </a>
        </nav>
      </div>
    </footer>
  );
}
