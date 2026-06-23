import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { LANGUAGES, pathForLanguage, type LanguageCode } from "@/lib/i18n";

const SITE_NAME: Record<LanguageCode, string> = {
  ar: "موروث ابن القيم",
  de: "Ibn al-Qayyim Vermächtnis",
  en: "Ibn al-Qayyim Legacy",
};

const SITE_DESCRIPTION: Record<LanguageCode, string> = {
  ar: "مكتبة رقمية لقراءة كتب الإمام ابن قيم الجوزية، مع الطبعات والفهارس والبحث والحفظ المحلي ومشاركة الاقتباسات.",
  de: "Eine digitale Bibliothek zum Lesen der Werke von Ibn Qayyim al-Dschauziyya, mit Ausgaben, Inhaltsverzeichnissen, Suche, lokaler Speicherung und Zitaten.",
  en: "A digital library for reading works by Ibn Qayyim al-Jawziyyah, with editions, indexes, search, local saving, and quote sharing.",
};

const ROUTE_TITLES: Record<LanguageCode, Record<string, string>> = {
  ar: {
    "/": "موروث ابن القيم",
    "/library": "مكتبة ابن القيم",
    "/reading-plan": "خطة القراءة",
    "/search": "البحث في كتب ابن القيم",
    "/saved": "المحفوظات المحلية",
    "/notes": "المحفوظات المحلية",
    "/profile": "المحفوظات المحلية",
  },
  de: {
    "/": "Ibn al-Qayyim Vermächtnis",
    "/library": "Bibliothek von Ibn al-Qayyim",
    "/search": "Ibn al-Qayyim durchsuchen",
    "/saved": "Lokale Leseablage",
    "/notes": "Lokale Leseablage",
    "/profile": "Lokale Leseablage",
  },
  en: {
    "/": "Ibn al-Qayyim Legacy",
    "/library": "Ibn al-Qayyim Library",
    "/search": "Search Ibn al-Qayyim",
    "/saved": "Local Reading Library",
    "/notes": "Local Reading Library",
    "/profile": "Local Reading Library",
  },
};

const NO_INDEX_PATHS = new Set(["/saved", "/notes", "/profile"]);

export interface SeoOptions {
  canonicalPath?: string;
  description?: string;
  image?: string;
  jsonLd?: Record<string, unknown>;
  noIndex?: boolean;
  title?: string;
  type?: "article" | "book" | "profile" | "website";
}

function stripLanguagePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && LANGUAGES.some((language) => language.code === segments[0])) {
    segments.shift();
  }
  return segments.length ? `/${segments.join("/")}` : "/";
}

function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = window.location.origin;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${basePath}${normalizedPath}`;
}

function setNamedMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function setPropertyMeta(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }
  element.href = href;
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.text = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

function titleFor(language: LanguageCode, path: string, title?: string) {
  if (title) return title === SITE_NAME[language] ? title : `${title} | ${SITE_NAME[language]}`;
  return ROUTE_TITLES[language][path] ?? SITE_NAME[language];
}

export function useSeo(language: LanguageCode, options: SeoOptions = {}) {
  const [location] = useLocation();
  const path = options.canonicalPath ?? stripLanguagePrefix(location.split("?")[0] || "/");
  const title = titleFor(language, path, options.title);
  const description = options.description ?? SITE_DESCRIPTION[language];
  const image = absoluteUrl(options.image ?? "/opengraph.jpg");
  const canonical = absoluteUrl(pathForLanguage(language, path));
  const noIndex = options.noIndex ?? NO_INDEX_PATHS.has(path);

  const defaultJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "WebSite",
      description: SITE_DESCRIPTION[language],
      inLanguage: language,
      name: SITE_NAME[language],
      potentialAction: {
        "@type": "SearchAction",
        queryInput: "required name=search_term_string",
        target: absoluteUrl(pathForLanguage(language, "/search?q={search_term_string}")),
      },
      url: absoluteUrl(pathForLanguage(language, "/")),
    }),
    [language],
  );

  useEffect(() => {
    document.title = title;

    setNamedMeta("description", description);
    setNamedMeta("robots", noIndex ? "noindex, nofollow" : "index, follow");
    setNamedMeta("twitter:card", "summary_large_image");
    setNamedMeta("twitter:title", title);
    setNamedMeta("twitter:description", description);
    setNamedMeta("twitter:image", image);

    setPropertyMeta("og:site_name", SITE_NAME[language]);
    setPropertyMeta("og:title", title);
    setPropertyMeta("og:description", description);
    setPropertyMeta("og:type", options.type ?? "website");
    setPropertyMeta("og:url", canonical);
    setPropertyMeta("og:image", image);
    setPropertyMeta("og:locale", language === "ar" ? "ar_AR" : language === "de" ? "de_DE" : "en_US");

    setLink("canonical", canonical);
    LANGUAGES.forEach((item) => {
      setLink("alternate", absoluteUrl(pathForLanguage(item.code, path)), item.code);
    });
    setLink("alternate", absoluteUrl(pathForLanguage("ar", path)), "x-default");

    setJsonLd("site-structured-data", defaultJsonLd);
    if (options.jsonLd) {
      setJsonLd("page-structured-data", options.jsonLd);
    } else {
      removeJsonLd("page-structured-data");
    }
  }, [canonical, defaultJsonLd, description, image, language, noIndex, options.jsonLd, options.type, path, title]);
}

export function siteDescription(language: LanguageCode) {
  return SITE_DESCRIPTION[language];
}
