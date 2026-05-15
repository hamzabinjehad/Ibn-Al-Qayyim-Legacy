import { ExternalLink, FileText, Github, MessageCircle, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/editorial/AppShell";
import PageFrame from "@/components/editorial/PageFrame";
import { CONTRIBUTION_LINKS, isConfiguredUrl } from "@/lib/contribution-links";
import { useUiTranslations } from "@/lib/ui-translations";

const SUPPORT_COPY = {
  ar: {
    title: "كيف تكون جزءاً من المشروع؟",
    intro:
      "نرحب بالمصممين والمبرمجين والمراجعين ومن يرغب في دعم نشر تراث ابن القيم بلغات متعددة. اختر الطريقة المناسبة، وسنراجع المساهمات قبل نشرها.",
    library: "العودة إلى المكتبة",
    availableSoon: "سيضاف الرابط قريباً",
    githubTitle: "راجع أو صحح ترجمة",
    githubDescription:
      "إذا وجدت خطأ في ترجمة ألمانية، افتح بلاغاً منظماً من القارئ أو عدّل ملف الترجمة على GitHub وأرسل اقتراحك للمراجعة.",
    githubAction: "فتح GitHub",
    formTitle: "Google Form",
    formDescription:
      "نموذج مختصر لتوضيح خبرتك، نوع مساهمتك، والملفات أو النماذج التي تريد إرسالها لنا.",
    formAction: "فتح النموذج",
    telegramTitle: "Telegram Bot",
    telegramDescription:
      "مسار سريع للتواصل وإرسال تفاصيل المساهمة حتى نرى أين يمكن أن تكون إضافتك أنسب.",
    telegramAction: "فتح البوت",
  },
  de: {
    title: "Wie kannst du Teil des Projekts werden?",
    intro:
      "Wir freuen uns über Designer, Entwickler, Übersetzungsprüfer und alle, die die Verbreitung der Werke Ibn al-Qayyims in mehreren Sprachen unterstützen möchten.",
    library: "Zur Bibliothek",
    availableSoon: "Link folgt bald",
    githubTitle: "Übersetzung prüfen oder korrigieren",
    githubDescription:
      "Wenn du einen Fehler in einer deutschen Übersetzung findest, öffne im Reader ein vorbereitetes GitHub-Issue oder bearbeite die Quelldatei direkt auf GitHub.",
    githubAction: "GitHub öffnen",
    formTitle: "Google Form",
    formDescription:
      "Ein kurzes Formular für deine Angaben, deine mögliche Rolle und Dateien oder Beispiele, die wir prüfen sollen.",
    formAction: "Formular öffnen",
    telegramTitle: "Telegram Bot",
    telegramDescription:
      "Ein schneller Weg für Kontakt und Details, damit wir sehen können, wie deine Mitarbeit am besten passt.",
    telegramAction: "Bot öffnen",
  },
  en: {
    title: "How can you be part of the project?",
    intro:
      "Designers, developers, translation reviewers, and supporters are welcome to help make Ibn al-Qayyim's works available in more languages.",
    library: "Back to library",
    availableSoon: "Link coming soon",
    githubTitle: "Review or correct a translation",
    githubDescription:
      "If you find a German translation issue, open a prefilled GitHub issue from the reader or edit the translation source file directly on GitHub.",
    githubAction: "Open GitHub",
    formTitle: "Google Form",
    formDescription:
      "A short form for your details, how you can help, and any files or samples you want us to review.",
    formAction: "Open form",
    telegramTitle: "Telegram Bot",
    telegramDescription:
      "A quick contact path for sharing contribution details so we can see where your help fits best.",
    telegramAction: "Open bot",
  },
} as const;

export default function Support() {
  const { language } = useUiTranslations();
  const copy = SUPPORT_COPY[language];

  return (
    <AppShell>
      <PageFrame maxWidth="max-w-5xl">
        <div className="mb-8">
          <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="/library">
            {copy.library}
          </Link>
        </div>

        <header className="max-w-3xl border-b border-border pb-9">
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{copy.title}</h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">{copy.intro}</p>
        </header>

        <section className="grid gap-4 pt-8 md:grid-cols-3">
          <SupportCard
            action={copy.githubAction}
            description={copy.githubDescription}
            href={CONTRIBUTION_LINKS.githubRepoUrl}
            icon={Github}
            title={copy.githubTitle}
          />
          <SupportCard
            action={copy.formAction}
            description={copy.formDescription}
            href={CONTRIBUTION_LINKS.googleFormUrl}
            icon={FileText}
            title={copy.formTitle}
            unavailableLabel={copy.availableSoon}
          />
          <SupportCard
            action={copy.telegramAction}
            description={copy.telegramDescription}
            href={CONTRIBUTION_LINKS.telegramBotUrl}
            icon={MessageCircle}
            title={copy.telegramTitle}
            unavailableLabel={copy.availableSoon}
          />
        </section>
      </PageFrame>
    </AppShell>
  );
}

function SupportCard({
  action,
  description,
  href,
  icon: Icon,
  title,
  unavailableLabel,
}: {
  action: string;
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
  unavailableLabel?: string;
}) {
  const configured = isConfiguredUrl(href);

  return (
    <article className="interactive-card flex min-h-64 flex-col p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold leading-7">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{description}</p>
      {configured ? (
        <a
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {action}
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <span className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-muted px-4 text-sm font-semibold text-muted-foreground">
          {unavailableLabel}
        </span>
      )}
    </article>
  );
}
