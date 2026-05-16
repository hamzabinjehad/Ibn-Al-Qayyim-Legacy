import type { CSSProperties } from "react";

export const HIGHLIGHT_PALETTE = [
  {
    name: "ذهبي",
    value: "#fff200",
    legacyValues: ["#f7efd8"],
    bg: "#fff200",
    fg: "#050505",
    border: "rgb(0 0 0 / 0.72)",
    rail: "rgb(0 0 0 / 0.92)",
    darkBg: "#fff200",
    darkFg: "#050505",
    darkBorder: "rgb(255 255 255 / 0.88)",
    darkRail: "rgb(255 255 255 / 1)",
  },
  {
    name: "أخضر",
    value: "#39ff14",
    legacyValues: ["#dff3df"],
    bg: "#39ff14",
    fg: "#031403",
    border: "rgb(0 43 0 / 0.72)",
    rail: "rgb(0 43 0 / 0.92)",
    darkBg: "#39ff14",
    darkFg: "#031403",
    darkBorder: "rgb(255 255 255 / 0.88)",
    darkRail: "rgb(255 255 255 / 1)",
  },
  {
    name: "أزرق",
    value: "#00e5ff",
    legacyValues: ["#dcecf8"],
    bg: "#00e5ff",
    fg: "#001014",
    border: "rgb(0 44 52 / 0.72)",
    rail: "rgb(0 44 52 / 0.92)",
    darkBg: "#00e5ff",
    darkFg: "#001014",
    darkBorder: "rgb(255 255 255 / 0.88)",
    darkRail: "rgb(255 255 255 / 1)",
  },
  {
    name: "وردي",
    value: "#ff4fd8",
    legacyValues: ["#f6e0e8"],
    bg: "#ff4fd8",
    fg: "#190014",
    border: "rgb(62 0 50 / 0.72)",
    rail: "rgb(62 0 50 / 0.92)",
    darkBg: "#ff4fd8",
    darkFg: "#190014",
    darkBorder: "rgb(255 255 255 / 0.88)",
    darkRail: "rgb(255 255 255 / 1)",
  },
] as const;

export function getHighlightTone(color: string) {
  const normalizedColor = color.toLowerCase();
  return (
    HIGHLIGHT_PALETTE.find(
      (item) => item.value === normalizedColor || item.legacyValues.some((value) => value === normalizedColor),
    ) ?? HIGHLIGHT_PALETTE[0]
  );
}

export function getHighlightStyle(color: string) {
  const tone = getHighlightTone(color);
  return {
    "--reader-highlight-bg": tone.bg,
    "--reader-highlight-fg": tone.fg,
    "--reader-highlight-border": tone.border,
    "--reader-highlight-rail": tone.rail,
    "--reader-highlight-dark-bg": tone.darkBg,
    "--reader-highlight-dark-fg": tone.darkFg,
    "--reader-highlight-dark-border": tone.darkBorder,
    "--reader-highlight-dark-rail": tone.darkRail,
  } as CSSProperties;
}
