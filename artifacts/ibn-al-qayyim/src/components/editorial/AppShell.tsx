import TopNav from "./TopNav";
import SiteFooter from "./SiteFooter";
import { useLanguage } from "@/lib/i18n";
import { useUiTranslations } from "@/lib/ui-translations";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { direction } = useLanguage();
  const { t } = useUiTranslations();
  const skipToMainContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const target = document.getElementById("main-content");
    if (!target) return;

    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
    window.history.replaceState(null, "", "#main-content");
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir={direction}>
      <a
        href="#main-content"
        className="sr-only fixed top-4 end-4 z-[70] rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
        onClick={skipToMainContent}
      >
        {t("تجاوز إلى المحتوى")}
      </a>
      <TopNav />
      {children}
      <SiteFooter />
    </div>
  );
}
