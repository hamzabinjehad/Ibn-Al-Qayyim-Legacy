import { AlertTriangle, Loader2 } from "lucide-react";
import { useUiTranslations } from "@/lib/ui-translations";

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  title: string;
}) {
  const { t } = useUiTranslations();

  return (
    <div className="surface-card px-6 py-14 text-center">
      <p className="font-semibold">{t(title)}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t(description)}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  description = "تعذر تحميل البيانات.",
  retry,
  title = "حدث خطأ",
}: {
  description?: string;
  retry?: () => void;
  title?: string;
}) {
  const { t } = useUiTranslations();

  return (
    <div className="surface-card px-6 py-14 text-center">
      <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
      <p className="font-semibold">{t(title)}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t(description)}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("إعادة المحاولة")}
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = "جار التحميل" }: { label?: string }) {
  const { t } = useUiTranslations();

  return (
    <div className="surface-card flex min-h-64 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="me-2 h-4 w-4 animate-spin" />
      {t(label)}
    </div>
  );
}
