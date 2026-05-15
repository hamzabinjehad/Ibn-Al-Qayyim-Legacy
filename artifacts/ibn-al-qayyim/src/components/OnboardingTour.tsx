import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";
import { useLocation } from "wouter";
import { DirectionalArrow } from "@/components/editorial/DirectionalIcon";
import {
  FEATURED_READING_EDITION_ID,
  FEATURED_READING_WORK_ID,
} from "@/lib/featured-reading";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useStaticBooks } from "@/lib/static-library";
import { useUiTranslations } from "@/lib/ui-translations";

const TOUR_STORAGE_KEY = "ibn-al-qayyim:onboarding-tour:v1";
const SPOTLIGHT_PADDING = 8;

interface OnboardingTourContextValue {
  activeStepId: TourStepId | null;
  isTourOpen: boolean;
  startTour: () => void;
}

export type TourStepId =
  | "welcome"
  | "search"
  | "library"
  | "start-reading"
  | "read-section"
  | "reader-controls"
  | "copy-chapter"
  | "select-text"
  | "selection-actions"
  | "share-quote"
  | "customize-image"
  | "export-share";

interface TourStep {
  body: string;
  id: TourStepId;
  path?: string;
  points?: string[];
  target?: string;
  title: string;
}

interface TargetRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(
  null,
);

function readTourSeen() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(TOUR_STORAGE_KEY) === "seen";
}

function markTourSeen() {
  window.localStorage.setItem(TOUR_STORAGE_KEY, "seen");
}

function selectorForTarget(target: string) {
  return `[data-tour="${target}"]`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetRect(target: string): TargetRect | null {
  const element = document.querySelector<HTMLElement>(
    selectorForTarget(target),
  );
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function getPanelStyle(rect: TargetRect | null): CSSProperties {
  if (typeof window === "undefined") return {};

  const margin = 16;
  const width = Math.min(420, window.innerWidth - margin * 2);

  if (!rect) {
    return {
      boxSizing: "border-box",
      left: "50%",
      maxWidth: width,
      top: "50%",
      transform: "translate(-50%, -50%)",
      width,
    };
  }

  const estimatedHeight = 300;
  const canFitBelow =
    window.innerHeight - rect.bottom > estimatedHeight + margin;
  const canFitAbove = rect.top > estimatedHeight + margin;
  const top = canFitBelow
    ? rect.bottom + margin
    : canFitAbove
      ? rect.top - estimatedHeight - margin
      : margin;
  const left = clamp(
    rect.left + rect.width / 2 - width / 2,
    margin,
    window.innerWidth - width - margin,
  );

  return {
    boxSizing: "border-box",
    left,
    maxWidth: width,
    top: clamp(
      top,
      margin,
      Math.max(margin, window.innerHeight - estimatedHeight - margin),
    ),
    width,
  };
}

function getSpotlightStyle(rect: TargetRect): CSSProperties {
  return {
    height: rect.height + SPOTLIGHT_PADDING * 2,
    left: rect.left - SPOTLIGHT_PADDING,
    top: rect.top - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
  };
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { direction, language } = useLanguage();
  const { formatNumber, t } = useUiTranslations();
  const { data: books } = useStaticBooks();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const sampleBook =
    books?.find((book) => book.id === FEATURED_READING_EDITION_ID) ??
    books?.find((book) => book.workId === FEATURED_READING_WORK_ID) ??
    books?.[0];
  const sampleReaderPath = sampleBook
    ? `/edition/${sampleBook.id}/section/${sampleBook.firstChapterId}`
    : "/library";

  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "welcome",
        title: "أهلا بك في موروث ابن القيم",
        body: "هذه جولة سريعة توضح كيف تبحث، تفتح كتابا، تنسخ النصوص، وتشارك اقتباسا منسقا كصورة قابلة للتعديل.",
      },
      {
        id: "search",
        title: "ابدأ بالبحث",
        body: "اكتب كلمة أو عبارة هنا للبحث في الكتب والفصول، ثم اضغط زر البحث للانتقال إلى النتائج.",
        path: "/",
        target: "home-search",
      },
      {
        id: "library",
        title: "افتح المكتبة",
        body: "من المكتبة يمكنك تصفح الأعمال المتاحة. اضغط أي بطاقة عمل للوصول إلى الطبعات ثم اختر الطبعة المناسبة.",
        path: "/library",
        target: "library-books",
      },
      {
        id: "start-reading",
        title: "ابدأ القراءة",
        body: "في صفحة طبعة الداء والدواء من عطاءات العلم يظهر زر بدء القراءة، ومنها تكمل الجولة داخل القارئ.",
        path: sampleBook ? `/edition/${sampleBook.id}` : "/library",
        target: "book-start-reading",
      },
      {
        id: "read-section",
        title: "اقرأ الفصل",
        body: "هذا هو سطح القراءة. مرر بين الصفحات، وسيحفظ الموقع موضعك محليا في هذا المتصفح.",
        path: sampleReaderPath,
        target: "reader-text",
      },
      {
        id: "reader-controls",
        title: "اضبط تجربة القراءة",
        body: "من هذا الشريط تفتح المحتويات، تكبر أو تصغر الخط، تغير نوع الخط، وتظهر أو تخفي التشكيل.",
        path: sampleReaderPath,
        target: "reader-toolbar",
      },
      {
        id: "copy-chapter",
        title: "انسخ نصا جاهزا للصق",
        body: "زر النسخ في أعلى القارئ ينسخ نص الفصل مع نسبة المصدر. بعد النسخ يمكنك لصقه في ملاحظاتك، بريدك، أو أي محرر نصوص.",
        path: sampleReaderPath,
        target: "reader-copy-chapter",
        points: [
          "النص المنسوخ يتضمن الكتاب والفصل.",
          "استخدمه عندما تريد حفظ الفصل أو جزء كبير منه خارج الموقع.",
        ],
      },
      {
        id: "select-text",
        title: "حدد جزءا من النص",
        body: "ظلّل عبارة داخل الصفحة كما تفعل في أي قارئ. عند ترك التحديد يظهر شريط أعمال سريع في أسفل الشاشة.",
        path: sampleReaderPath,
        target: "reader-selection",
        points: [
          "يمكنك تظليل العبارة، حفظ ملاحظة، نسخها، أو تحويلها إلى بطاقة مشاركة.",
        ],
      },
      {
        id: "selection-actions",
        title: "اختر ما تريد فعله بالاقتباس",
        body: "هذا مثال للشريط الذي يظهر بعد تحديد النص. زر النسخ يعطيك نصا منسقا للصق، وزر المشاركة يفتح بطاقة اقتباس جاهزة.",
        path: sampleReaderPath,
        target: "reader-selection-demo",
      },
      {
        id: "share-quote",
        title: "شارك جزءا منسقا",
        body: "عند الضغط على مشاركة، يولد الموقع بطاقة اقتباس بالصورة والمعنى: النص في الوسط، والمصدر محفوظ أسفل البطاقة.",
        path: sampleReaderPath,
        target: "quote-card-preview",
      },
      {
        id: "customize-image",
        title: "عدّل صورة الاقتباس",
        body: "من هذه اللوحة تستطيع اختيار قالب البطاقة، مقاس مربع أو قصة، إظهار المصدر، وتغيير ألوان التأكيد والخلفية قبل التصدير.",
        path: sampleReaderPath,
        target: "quote-card-tools",
      },
      {
        id: "export-share",
        title: "صدّر أو شارك",
        body: "بعد ضبط الصورة حمّلها، انسخ النص، أو استخدم المشاركة المباشرة عندما يدعمها المتصفح. هكذا يصبح الاقتباس جاهزا للنشر أو الحفظ.",
        path: sampleReaderPath,
        target: "quote-card-actions",
      },
    ],
    [sampleBook, sampleReaderPath],
  );

  const activeStep = steps[currentStep] ?? steps[0];
  const hasTarget = Boolean(activeStep.target);
  const isLastStep = currentStep === steps.length - 1;
  const panelStyle = getPanelStyle(targetRect);
  const stepNumber = formatNumber(currentStep + 1);
  const stepCount = formatNumber(steps.length);

  const closeTour = useCallback(
    (options?: { returnHome?: boolean }) => {
      markTourSeen();
      setIsTourOpen(false);
      setCurrentStep(0);
      setTargetRect(null);
      setTargetMissing(false);
      if (options?.returnHome && location !== "/") navigate("/");
    },
    [location, navigate],
  );

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setTargetRect(null);
    setTargetMissing(false);
    setIsTourOpen(true);
  }, []);

  const nextStep = () => {
    if (isLastStep) {
      closeTour({ returnHome: true });
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const previousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  useEffect(() => {
    if (language === "ar" && !readTourSeen()) {
      setIsTourOpen(true);
    }
  }, [language]);

  useEffect(() => {
    if (!isTourOpen || !activeStep.path || location === activeStep.path) return;
    navigate(activeStep.path);
  }, [activeStep.path, isTourOpen, location, navigate]);

  useEffect(() => {
    if (!isTourOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTour();
      if (event.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight"))
        nextStep();
      if (event.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft"))
        previousStep();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTour, direction, isTourOpen, nextStep, previousStep]);

  useEffect(() => {
    if (!isTourOpen || !activeStep.target) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }

    let disposed = false;
    let attempts = 0;
    let scrolled = false;
    let timer = 0;

    const capture = () => {
      if (disposed || !activeStep.target) return;
      const element = document.querySelector<HTMLElement>(
        selectorForTarget(activeStep.target),
      );

      if (!element) {
        attempts += 1;
        if (attempts > 20) {
          setTargetRect(null);
          setTargetMissing(true);
          return;
        }
        timer = window.setTimeout(capture, 120);
        return;
      }

      if (!scrolled) {
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
        scrolled = true;
        timer = window.setTimeout(capture, 240);
        return;
      }

      const nextRect = getTargetRect(activeStep.target);
      setTargetRect(nextRect);
      setTargetMissing(!nextRect);
    };

    const updateWithoutScroll = () => {
      if (!activeStep.target) return;
      const nextRect = getTargetRect(activeStep.target);
      setTargetRect(nextRect);
      setTargetMissing(!nextRect);
    };

    timer = window.setTimeout(capture, 80);
    window.addEventListener("resize", updateWithoutScroll);
    window.addEventListener("scroll", updateWithoutScroll, true);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateWithoutScroll);
      window.removeEventListener("scroll", updateWithoutScroll, true);
    };
  }, [activeStep.target, currentStep, isTourOpen, location]);

  const contextValue = useMemo(
    () => ({
      activeStepId: isTourOpen ? activeStep.id : null,
      isTourOpen,
      startTour,
    }),
    [activeStep.id, isTourOpen, startTour],
  );

  return (
    <OnboardingTourContext.Provider value={contextValue}>
      {children}
      {isTourOpen && (
        <div className="fixed inset-0 z-[80] font-ui" dir={direction}>
          {targetRect ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed rounded-xl border border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_24px_80px_-28px_rgba(0,0,0,0.65)] ring-2 ring-primary/80"
              style={getSpotlightStyle(targetRect)}
            />
          ) : (
            <div aria-hidden="true" className="fixed inset-0 bg-black/62" />
          )}

          <section
            aria-modal="true"
            className="fixed rounded-xl border border-border bg-background p-5 text-foreground shadow-[0_28px_90px_-38px_rgba(0,0,0,0.85)]"
            role="dialog"
            style={panelStyle}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("خطوة {current} من {total}", {
                    current: stepNumber,
                    total: stepCount,
                  })}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
                  {t(activeStep.title)}
                </h2>
              </div>
              <button
                aria-label={t("إغلاق")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => closeTour()}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t(activeStep.body)}
            </p>

            {activeStep.points && (
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted-foreground">
                {activeStep.points.map((point) => (
                  <li className="flex gap-2" key={point}>
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(point)}</span>
                  </li>
                ))}
              </ul>
            )}

            {targetMissing && hasTarget && (
              <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs leading-6 text-muted-foreground">
                {t(
                  "لم يظهر هذا الموضع بعد. يمكنك المتابعة، وستنتقل الجولة إلى الخطوة التالية.",
                )}
              </p>
            )}

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-40",
                  currentStep === 0 && "hidden",
                )}
                disabled={currentStep === 0}
                onClick={previousStep}
                type="button"
              >
                <DirectionalArrow className="h-4 w-4" role="back" />
                {t("السابق")}
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                onClick={nextStep}
                type="button"
              >
                {isLastStep ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("إنهاء")}
                  </>
                ) : (
                  <>
                    {currentStep === 0 ? t("ابدأ الجولة") : t("التالي")}
                    <DirectionalArrow className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                className="ms-auto inline-flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => closeTour()}
                type="button"
              >
                {t("تخطي")}
              </button>
            </div>
          </section>
        </div>
      )}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  const context = useContext(OnboardingTourContext);
  if (!context) {
    throw new Error(
      "useOnboardingTour must be used within OnboardingTourProvider",
    );
  }
  return context;
}
