import { useEffect, useState } from "react";

const THEME_COLORS = { dark: "#0a0a0a", light: "#ffffff" };

function applyThemeColor(dark: boolean) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((el) => {
    const media = el.getAttribute("media") ?? "";
    if (media.includes("dark")) el.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
    else if (media.includes("light")) el.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
    else el.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  });
}

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    applyThemeColor(dark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    applyThemeColor(next);
  };

  return { dark, toggle };
}
