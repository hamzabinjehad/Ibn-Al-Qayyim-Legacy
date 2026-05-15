import { createContext, useContext, useEffect, type ReactNode } from "react";

export type LanguageCode = "ar" | "de" | "en";
export type TextDirection = "ltr" | "rtl";

export interface LanguageDefinition {
  code: LanguageCode;
  direction: TextDirection;
  label: string;
  nativeName: string;
}

export const LANGUAGES: LanguageDefinition[] = [
  { code: "ar", direction: "rtl", label: "Arabic", nativeName: "العربية" },
  { code: "de", direction: "ltr", label: "German", nativeName: "Deutsch" },
  { code: "en", direction: "ltr", label: "English", nativeName: "English" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "ar";

const LANGUAGE_CODES = new Set<string>(LANGUAGES.map((language) => language.code));

interface LanguageContextValue {
  direction: TextDirection;
  language: LanguageCode;
  languagePrefix: string;
}

const LanguageContext = createContext<LanguageContextValue>({
  direction: "rtl",
  language: DEFAULT_LANGUAGE,
  languagePrefix: "",
});

export function normalizeLanguage(value: string | undefined): LanguageCode {
  return value && LANGUAGE_CODES.has(value) ? (value as LanguageCode) : DEFAULT_LANGUAGE;
}

export function languageFromPath(pathname: string, basePath = "") {
  const base = basePath.replace(/\/$/, "");
  const relative = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
  const firstSegment = relative.split("/").filter(Boolean)[0];
  return LANGUAGE_CODES.has(firstSegment ?? "") ? (firstSegment as LanguageCode) : undefined;
}

export function languageDefinition(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]!;
}

export function LanguageProvider({
  children,
  language,
  languagePrefix,
}: {
  children: ReactNode;
  language: LanguageCode;
  languagePrefix: string;
}) {
  const definition = languageDefinition(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = definition.direction;
    document.title =
      language === "de" ? "Ibn al-Qayyim Vermächtnis" : language === "en" ? "Ibn al-Qayyim Legacy" : "تراث ابن القيم";
  }, [definition.direction, language]);

  return (
    <LanguageContext.Provider value={{ direction: definition.direction, language, languagePrefix }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function pathForLanguage(language: LanguageCode, path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments[0] && LANGUAGE_CODES.has(segments[0])) segments.shift();
  const localizedPath = segments.length ? `/${segments.join("/")}` : "";
  return `/${language}${localizedPath}`;
}
