import { useEffect, useState } from "react";

export type ThemeMode = "light" | "sepia" | "dark";

const THEME_BG: Record<ThemeMode, string> = {
  dark: "#08090f",
  light: "#ffffff",
  sepia: "#f0e6d0",
};

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "sepia" || stored === "light") return stored;
  return "dark";
}

function applyMode(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.classList.toggle("sepia", mode === "sepia");
  const bg = THEME_BG[mode];
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((el) => {
    el.content = bg;
  });
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);

  useEffect(() => {
    applyMode(mode);
  }, []);

  const toggle = () => {
    const next: ThemeMode = mode === "light" ? "sepia" : mode === "sepia" ? "dark" : "light";
    setMode(next);
    applyMode(next);
    localStorage.setItem("theme", next);
  };

  return { dark: mode === "dark", mode, toggle };
}
