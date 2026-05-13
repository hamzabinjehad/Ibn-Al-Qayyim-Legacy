import type { CSSProperties } from "react";

export const HIGHLIGHT_PALETTE = [
  {
    name: "ذهبي",
    value: "#f7efd8",
    bg: "rgb(247 239 216 / 0.9)",
    border: "rgb(201 168 76 / 0.34)",
    rail: "rgb(201 168 76 / 0.68)",
    darkBg: "rgb(146 107 32 / 0.46)",
    darkBorder: "rgb(240 202 112 / 0.5)",
    darkRail: "rgb(240 202 112 / 0.82)",
  },
  {
    name: "أخضر",
    value: "#dff3df",
    bg: "rgb(223 243 223 / 0.9)",
    border: "rgb(91 142 94 / 0.34)",
    rail: "rgb(91 142 94 / 0.68)",
    darkBg: "rgb(55 114 71 / 0.5)",
    darkBorder: "rgb(139 207 151 / 0.52)",
    darkRail: "rgb(139 207 151 / 0.86)",
  },
  {
    name: "أزرق",
    value: "#dcecf8",
    bg: "rgb(220 236 248 / 0.9)",
    border: "rgb(73 132 173 / 0.34)",
    rail: "rgb(73 132 173 / 0.68)",
    darkBg: "rgb(40 96 139 / 0.52)",
    darkBorder: "rgb(130 190 232 / 0.54)",
    darkRail: "rgb(130 190 232 / 0.88)",
  },
  {
    name: "وردي",
    value: "#f6e0e8",
    bg: "rgb(246 224 232 / 0.9)",
    border: "rgb(171 92 119 / 0.34)",
    rail: "rgb(171 92 119 / 0.68)",
    darkBg: "rgb(135 57 88 / 0.52)",
    darkBorder: "rgb(231 145 176 / 0.54)",
    darkRail: "rgb(231 145 176 / 0.88)",
  },
] as const;

export function getHighlightTone(color: string) {
  return HIGHLIGHT_PALETTE.find((item) => item.value === color) ?? HIGHLIGHT_PALETTE[0];
}

export function getHighlightStyle(color: string) {
  const tone = getHighlightTone(color);
  return {
    "--reader-highlight-bg": tone.bg,
    "--reader-highlight-border": tone.border,
    "--reader-highlight-rail": tone.rail,
    "--reader-highlight-dark-bg": tone.darkBg,
    "--reader-highlight-dark-border": tone.darkBorder,
    "--reader-highlight-dark-rail": tone.darkRail,
  } as CSSProperties;
}
