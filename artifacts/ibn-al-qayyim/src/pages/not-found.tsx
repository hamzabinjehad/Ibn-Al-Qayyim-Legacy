import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import { useUiTranslations } from "@/lib/ui-translations";

export default function NotFound() {
  const { direction, t } = useUiTranslations();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background" dir={direction}>
      <div className="text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-5xl font-bold text-foreground mb-3">404</h1>
        <p className="text-xl font-semibold text-foreground mb-2">{t("الصفحة غير موجودة")}</p>
        <p className="text-sm text-muted-foreground mb-8">
          {t("يبدو أن هذه الصفحة لا وجود لها أو أن الرابط خاطئ.")}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          {t("العودة إلى الرئيسية")}
        </Link>
      </div>
    </div>
  );
}
