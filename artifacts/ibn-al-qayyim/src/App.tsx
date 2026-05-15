import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnboardingTourProvider } from "@/components/OnboardingTour";
import PwaInstallPromptModal from "@/components/PwaInstallPromptModal";
import { LanguageProvider, languageFromPath, normalizeLanguage, type LanguageCode } from "@/lib/i18n";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Library = lazy(() => import("@/pages/Library"));
const ReadingPlan = lazy(() => import("@/pages/ReadingPlan"));
const WorkDetail = lazy(() => import("@/pages/WorkDetail"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));
const BookEditions = lazy(() => import("@/pages/BookEditions"));
const ChapterReader = lazy(() => import("@/pages/ChapterReader"));
const Search = lazy(() => import("@/pages/Search"));
const Notes = lazy(() => import("@/pages/Notes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router({ language }: { language: LanguageCode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/library" component={Library} />
        {language === "ar" && <Route path="/reading-plan" component={ReadingPlan} />}
        <Route path="/editions/:slug" component={BookEditions} />
        <Route path="/work/:workId" component={WorkDetail} />
        <Route path="/edition/:editionId" component={BookDetail} />
        <Route path="/edition/:editionId/section/:sectionId" component={ChapterReader} />
        <Route path="/book/:bookId" component={BookDetail} />
        <Route path="/book/:bookId/chapter/:chapterId" component={ChapterReader} />
        <Route path="/search" component={Search} />
        <Route path="/notes" component={Notes} />
        <Route path="/profile" component={Notes} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathLanguage = languageFromPath(window.location.pathname, basePath);
  const language = normalizeLanguage(pathLanguage);
  const languagePrefix = pathLanguage ? `/${language}` : "";

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider language={language} languagePrefix={languagePrefix}>
        <WouterRouter base={`${basePath}${languagePrefix}`}>
          <OnboardingTourProvider>
            <Router language={language} />
            <PwaInstallPromptModal />
          </OnboardingTourProvider>
        </WouterRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
