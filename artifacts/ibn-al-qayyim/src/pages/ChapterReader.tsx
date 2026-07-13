import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  ExternalLink,
  Github,
  Menu,
  Highlighter,
  MessageSquareWarning,
  Search,
  Share2,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useOnboardingTour } from "@/components/OnboardingTour";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import ProgressLine from "@/components/editorial/ProgressLine";
import QuoteShareModal from "@/components/QuoteShareModal";
import {
  ChapterNav,
  FocusModeOverlay,
  PageFootnotes,
  ReaderToc,
  ReaderToolbar,
  TourSelectionActionsDemo,
  renderHighlightedText,
} from "@/components/reader/ReaderPanels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildSourceEditUrl, buildTranslationIssueUrl } from "@/lib/contribution-links";
import { getHighlightStyle, HIGHLIGHT_PALETTE } from "@/lib/highlights";
import { type LocalHighlight, type ReaderSettings, stripHarakat, useLocalLibrary } from "@/lib/local-library";
import { calculateBookPageProgress } from "@/lib/reading-progress";
import { useSeo } from "@/lib/seo";
import { sectionTypeLabel, useStaticBook, useStaticBookChapter } from "@/lib/static-library";
import { cleanBabTitle, stripSectionTypePrefix } from "@/lib/section-title";
import { pageText, readingMetaText, translateUi, useUiTranslations } from "@/lib/ui-translations";
import {
  buildShareText,
  copyText,
  currentScrollY,
  displayFootnoteMarker,
  displayPageNumber,
  FOOTNOTE_DIGIT_CLASS,
  FOOTNOTE_FOCUS_MS,
  FOOTNOTE_REFERENCE_REGEX,
  footnoteId,
  getSelectionPosition,
  type HighlightColor,
  isPositionedHighlight,
  normalizeFootnoteMarker,
  type PageFootnote,
  type ParsedFootnote,
  scrollTopThreshold,
  type ReaderStatus,
  type SelectionPosition,
  splitPageFootnotes,
} from "@/lib/reader-utils";

// ── Rich-text token types ──────────────────────────────────────────────────
// U+FD3E/FD3F ornate brackets are used exclusively for Quranic verses in Arabic
const QURAN_VERSE_ORNATE_REGEX = /﴿([^﴾]{1,600})﴾(?:\s*\[([^\]\n]{1,100})\])?/gu;
// Shamela: {verse} [Surah:Ayah] — explicit ref variant
const QURAN_VERSE_CURLY_REGEX = /\{([^}\n]{1,600})\}\s*\[([^\]\n]{1,100})\]/gu;
// Shamela: {verse} without ref — Shamela uses curly braces exclusively for Quranic verses
const QURAN_VERSE_CURLY_NOREF_REGEX = /\{([^}\n]{5,500})\}(?!\s*\[)/gu;
// [[H:heading text]] — emitted by extract-ibn-qayyim.ts for title spans
const INLINE_HEADING_REGEX = /\[\[H:([^\]]{1,300})\]\]/gu;
// ((heading)) — Shamela double-paren section label: ((أقسام النعمة))
const SHAMELA_DOUBLE_PAREN_REGEX = /\(\(([^)\n]{6,150})\)\)/gu;
// [heading] — Shamela single-bracket topic marker: [النعمة المطلقة]
// Excluded: verse refs (\d in content or colon-digit pattern), footnote markers, and
// brackets immediately following } or ﴾ (verse refs already consumed by verse regex)
const SHAMELA_BRACKET_REGEX = /\[([^\]\n]{2,80})\]/gu;
// Muhaqqiq apparatus vocabulary — bracketed notes like [سقط من الأصل] are editorial,
// not section topics, and must not be styled as headings.
const EDITORIAL_BRACKET_REGEX =
  /سقط|ساقط|كذا|الأصل|هامش|نسخ|بياض|مكرر|زياد|تحرف|تصحف|مثبت|طمس|مطموس|غير واضح|ليست في|ليس في/u;
// Leading section-type words to ignore when comparing an inline [[H:]] heading with
// the chapter title (the <h1> shows the title with this prefix stripped).
const TITLE_TYPE_PREFIX_REGEX =
  /^(?:كتاب|الكتاب|باب|الباب|فصل|الفصل|مسألة|مسالة|مسئلة|فائدة|قاعدة|تنبيه|مطلب|خاتمة)\s*[:،.]?\s*/u;

function buildTitleComparisonKeys(value: string): string[] {
  const full = stripHarakat(value).replace(/\s+/g, " ").trim();
  const stripped = full.replace(TITLE_TYPE_PREFIX_REGEX, "").trim();
  return stripped && stripped !== full ? [full, stripped] : [full];
}

// ── Find-in-section ────────────────────────────────────────────────────────
// Matches render as ephemeral LocalHighlight entries flowing through the same
// highlight pipeline as saved highlights (id prefix marks them as transient).
const FIND_MATCH_ID_PREFIX = "find-match:";
const FIND_MATCH_COLOR = "#fff200";
const FIND_ACTIVE_MATCH_COLOR = "#00e5ff";
const MAX_FIND_MATCHES = 300;

// 1:1 character folding (never changes string length, so harakat index maps stay valid)
function unifyArabicChars(value: string) {
  return value.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}

function normalizeFindQuery(value: string) {
  return unifyArabicChars(stripHarakat(value)).replace(/\s+/g, " ").trim().toLowerCase();
}
// Enumeration labels at sentence boundaries: أحدها: والثاني: الثالث: ومنها: القول الأول: etc.
// Works on un-voweled text (most of the corpus). Group 1 = boundary; Group 2 = label.
const ENUM_LABEL_REGEX =
  /(^|[\n.]\s*)((?:[وف])?(?:أ(?:حده?ا|وله?ا|ولاً?)|[وف]?(?:ال)?(?:ثاني?(?:ة|ه?ا)?|ثالث(?:ة|ه?ا)?|رابع(?:ة|ه?ا)?|خامس(?:ة|ه?ا)?|سادس(?:ة|ه?ا)?|سابع(?:ة|ه?ا)?|ثامن(?:ة|ه?ا)?|تاسع(?:ة|ه?ا)?|عاشر(?:ة|ه?ا)?)|ثانياً?|ثالثاً?|رابعاً?|خامساً?|سادساً?|سابعاً?|ثامناً?|تاسعاً?|عاشراً?|[وف]?منه[ام]|(?:القول|الوجه|الجواب|السؤال|الدليل|الفائدة|النوع|الضرب)\s+(?:الأول[ىة]?|الثاني?ة?|الثالث?ة?|الرابع?ة?|الخامس?ة?))\s*[:：])/gmu;
// Speaker attribution at sentence/paragraph boundaries: قال ابن القيم: / وذكر الإمام أحمد: / فروى البخاري:
// Group 1 = boundary char (not part of token); Group 2 = full attribution phrase.
const SPEAKER_ATTR_REGEX =
  /(^|[\n.]\s*)((?:[وف])?(?:قال|قالت|ذكر|روى|نقل|حكى|أخرجه|رواه|أورده)\s+[^\n:،.]{4,75}?\s*[:：])/gmu;
// For blockquote detection: paragraph ends with a speaker attribution colon.
const BLOCK_ATTR_END_REGEX =
  /(?:[وف])?(?:قال|قالت|ذكر|روى|نقل|حكى|أخرجه|رواه|أورده)\s+[^\n:،.]{4,75}?\s*[:：]\s*$/mu;

// ── Poetry (شعر) detection ─────────────────────────────────────────────────
// Numbered dīwān verse: "312 - صدر البيت … عجز البيت" (e.g. النونية). Verses chain
// inline within one paragraph, and "* * *" separates poem sections.
const NUMBERED_BAYT_REGEX =
  /(^|\s)([0-9٠-٩۰-۹]{1,4}\s*[-–—]\s*)([^…\n]{5,130}?)(\s*…\s*)([^\n]{5,170}?)(?=\s*[0-9٠-٩۰-۹]{1,4}\s*[-–—]|\s*\*\s?\*\s?\*|\s*$|\n)/gmu;
const VERSE_DIVIDER_REGEX = /(^|\s)\*\s?\*\s?\*(?=\s|$)/gmu;
// Attribution that introduces quoted poetry inside prose: قال الشاعر: / كما قيل (3):
// The "…" hemistich separator + hemistich validation do the real filtering — the same
// ellipsis is also used as a truncation mark in titles ("الجواب الكافي … "), so every
// candidate must pass the checks below or it stays prose.
const POETRY_ATTR_REGEX = /(?:[وف])?(?:قال|قالت|أنشد|أنشدت|قيل|يقول)[^:：\n.؟!]{0,60}?[:：]\s*/gu;
const HEMISTICH_FORBIDDEN_REGEX = /["«»“”\[\]{}﴿﴾.؟!]/u;
const ARABIC_TWO_WORDS_REGEX = /[ء-يٱ-ۓ]{2,}[^\S\n]+[ء-يٱ-ۓ]{2,}/u;
const VERSE_HARD_STOP_REGEX = new RegExp(`\\(\\^?[${FOOTNOTE_DIGIT_CLASS}]{1,3}\\)|[{﴿«"\\n]`, "u");

function isValidHemistich(candidate: string, opts: { allowColon: boolean }): boolean {
  const trimmed = stripHarakat(candidate).trim();
  if (trimmed.length < 8 || trimmed.length > 130) return false;
  if (HEMISTICH_FORBIDDEN_REGEX.test(trimmed)) return false;
  if (!opts.allowColon && /[:：]/u.test(trimmed)) return false;
  // Must start with an Arabic letter (or tatweel — hemistichs can split a word: "الْـ … ـعَدَمِ")
  if (!/^[ء-يٱ-ۓـ]/u.test(trimmed)) return false;
  return ARABIC_TWO_WORDS_REGEX.test(trimmed);
}

// Chained verses have no delimiter between one bayt's second hemistich and the next
// bayt's first ("… ajz1 sadr2 …"): hemistichs of a poem are metrically near-equal, so
// cut the zone at the word boundary whose length best matches the previous hemistich.
// When the poem's rhyme letter is known, only rhyme-ending words qualify as the cut.
function splitHemistichZone(
  zone: string,
  targetLen: number,
  opts: { rhyme?: string; allowFullZone?: boolean } = {},
): number | null {
  let best: { cut: number; diff: number } | null = null;
  for (const m of zone.matchAll(/\S+/gu)) {
    const end = m.index! + m[0].length;
    const len = stripHarakat(zone.slice(0, end)).trim().length;
    if (len < targetLen * 0.45) continue;
    if (len > targetLen * 1.9) break;
    if (opts.rhyme) {
      const word = stripHarakat(m[0]).replace(/[^ء-يٱ-ۓ]/gu, "");
      if (!word.endsWith(opts.rhyme)) continue;
    }
    const diff = Math.abs(len - targetLen);
    if (!best || diff < best.diff) best = { cut: end, diff };
  }
  if (!best) return null;
  return opts.allowFullZone || best.cut < zone.length ? best.cut : null;
}

function rhymeLetter(hemistich: string): string | undefined {
  const letters = stripHarakat(hemistich).replace(/[^ء-يٱ-ۓ]/gu, "");
  return letters.length > 0 ? letters[letters.length - 1] : undefined;
}

function collectPoetryTokens(text: string): RichToken[] {
  const tokens: RichToken[] = [];

  for (const m of text.matchAll(NUMBERED_BAYT_REGEX)) {
    const start = m.index! + m[1]!.length;
    const sadrStart = start + m[2]!.length;
    const sadrEnd = sadrStart + m[3]!.length;
    const ajzStart = sadrEnd + m[4]!.length;
    const end = ajzStart + m[5]!.length;
    if (!isValidHemistich(m[3]!, { allowColon: true }) || !isValidHemistich(m[5]!, { allowColon: true })) continue;
    tokens.push({ kind: "bayt", start, end, sadrStart, sadrEnd, ajzStart });
  }

  for (const m of text.matchAll(VERSE_DIVIDER_REGEX)) {
    const start = m.index! + (m[1]?.length ?? 0);
    tokens.push({ kind: "verse-divider", start, end: m.index! + m[0].length });
  }

  for (const attr of text.matchAll(POETRY_ATTR_REGEX)) {
    const verseStart = attr.index! + attr[0].length;
    const firstEll = text.indexOf("…", verseStart);
    if (firstEll === -1 || firstEll - verseStart > 140) continue;
    if (!isValidHemistich(text.slice(verseStart, firstEll), { allowColon: false })) continue;

    const verses: Array<{ sadrStart: number; sadrEnd: number; ajzStart: number; end: number }> = [];
    let sadrStart = verseStart;
    let sadrEnd = firstEll;
    let cursor = firstEll + 1;
    let prevSadrLen = stripHarakat(text.slice(verseStart, firstEll)).trim().length;
    let rhyme: string | undefined;
    let aborted = false;

    while (!aborted) {
      const rest = text.slice(cursor);
      const hardStopMatch = VERSE_HARD_STOP_REGEX.exec(rest);
      const hardStop = cursor + (hardStopMatch ? hardStopMatch.index : rest.length);
      const nextEll = text.indexOf("…", cursor);

      if (nextEll !== -1 && nextEll < hardStop) {
        // Middle zone: this bayt's ajz + the next bayt's sadr, split by balance
        // (preferring a rhyme-ending word once the poem's rhyme is known).
        const zone = text.slice(cursor, nextEll);
        const cut = splitHemistichZone(zone, prevSadrLen, { rhyme }) ?? splitHemistichZone(zone, prevSadrLen);
        if (
          cut === null ||
          !isValidHemistich(zone.slice(0, cut), { allowColon: true }) ||
          !isValidHemistich(zone.slice(cut), { allowColon: false })
        ) {
          aborted = true;
          break;
        }
        verses.push({ sadrStart, sadrEnd, ajzStart: cursor, end: cursor + cut });
        rhyme = rhyme ?? rhymeLetter(zone.slice(0, cut));
        sadrStart = cursor + cut;
        sadrEnd = nextEll;
        prevSadrLen = stripHarakat(zone.slice(cut)).trim().length;
        cursor = nextEll + 1;
        continue;
      }

      // Final ajz: close at a hard stop (footnote ref, quote, newline, paragraph end)
      // when it lands within the balanced window; when prose keeps running, cut at the
      // rhyme-matching word instead. Without either signal, treat the whole candidate
      // as a truncation ellipsis and abort — a long prose run is not a hemistich.
      const zone = text.slice(cursor, hardStop);
      const zoneLen = stripHarakat(zone).trim().length;
      if (zoneLen <= prevSadrLen * 1.9 + 12) {
        if (!isValidHemistich(zone, { allowColon: true })) {
          aborted = true;
          break;
        }
        verses.push({ sadrStart, sadrEnd, ajzStart: cursor, end: hardStop });
        break;
      }
      const rhymeCut = rhyme ? splitHemistichZone(zone, prevSadrLen, { rhyme, allowFullZone: true }) : null;
      if (rhymeCut === null || !isValidHemistich(zone.slice(0, rhymeCut), { allowColon: true })) {
        aborted = true;
        break;
      }
      verses.push({ sadrStart, sadrEnd, ajzStart: cursor, end: cursor + rhymeCut });
      break;
    }

    if (aborted) continue;
    for (const verse of verses) {
      tokens.push({ kind: "bayt", ...verse, start: verse.sadrStart });
    }
  }

  return tokens;
}

// Strips Arabic diacritics and returns a position map: map[strippedIdx] = originalIdx.
// Used so attribution/enumeration regexes match regardless of harakat display setting.
// Ranges: U+0610-061A (extended signs), U+064B-065F (common harakat), U+06D6-06ED (Quranic).
function buildHarakatMap(text: string): { stripped: string; map: number[] } {
  const map: number[] = [];
  let stripped = "";
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    const isHarakat =
      (cp >= 0x0610 && cp <= 0x061a) ||
      (cp >= 0x064b && cp <= 0x065f) ||
      (cp >= 0x06d6 && cp <= 0x06ed);
    if (!isHarakat) {
      stripped += text[i];
      map.push(i);
    }
  }
  return { stripped, map };
}

type RichToken =
  | { kind: "verse"; start: number; end: number; verseText: string; ref: string | undefined }
  | { kind: "heading"; start: number; end: number; text: string }
  | { kind: "topic-paren"; start: number; end: number; text: string }
  | { kind: "topic-bracket"; start: number; end: number; text: string }
  | { kind: "enum-label"; start: number; end: number; text: string }
  | { kind: "speaker-attr"; start: number; end: number; text: string }
  | { kind: "footnote"; start: number; end: number; marker: string; targetId: string }
  | { kind: "suppress"; start: number; end: number }
  // Poetry couplet: [start..sadrStart) = verse number prefix (numbered poems only),
  // [sadrStart..sadrEnd) = first hemistich, [sadrEnd..ajzStart) = "…" separator,
  // [ajzStart..end) = second hemistich. Raw slices are kept so DOM text matches the
  // source text exactly and highlight offsets stay accurate.
  | { kind: "bayt"; start: number; end: number; sadrStart: number; sadrEnd: number; ajzStart: number }
  | { kind: "verse-divider"; start: number; end: number };

// Returns a CSS class string reflecting heading hierarchy detected from text keywords
function headingCssClass(text: string): string {
  const t = text.trimStart();
  if (/^كتاب(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-kitab";
  if (/^باب(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-bab";
  if (/^(?:فصل|خاتمة)(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-fasl";
  if (/^(?:فائدة|تنبيه|مسألة|مسئلة|قاعدة|مطلب|فرع|ملحوظة)(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-sub";
  return "reader-inline-heading";
}

function collectRichTokens(
  text: string,
  footnoteTargets: Map<string, string>,
  chapterTitleAr?: string,
): RichToken[] {
  const raw: RichToken[] = [];
  const titleKeys = chapterTitleAr ? buildTitleComparisonKeys(chapterTitleAr) : null;

  for (const m of text.matchAll(QURAN_VERSE_ORNATE_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `﴿${m[1]}﴾`, ref: m[2] });
  }
  for (const m of text.matchAll(QURAN_VERSE_CURLY_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `{${m[1]}}`, ref: m[2] });
  }
  for (const m of text.matchAll(QURAN_VERSE_CURLY_NOREF_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `{${m[1]}}`, ref: undefined });
  }
  for (const m of text.matchAll(INLINE_HEADING_REGEX)) {
    if (titleKeys) {
      // The <h1> may show a cleaned title (type prefix stripped), so compare the
      // normalized forms both with and without the type-word prefix.
      const headingKeys = buildTitleComparisonKeys(m[1]!);
      if (headingKeys.some((key) => titleKeys.includes(key))) {
        // Consume the raw [[H:...]] marker without rendering it — the <h1> already shows the title
        raw.push({ kind: "suppress", start: m.index!, end: m.index! + m[0].length });
        continue;
      }
    }
    raw.push({ kind: "heading", start: m.index!, end: m.index! + m[0].length, text: m[1]! });
  }
  for (const m of text.matchAll(FOOTNOTE_REFERENCE_REGEX)) {
    const prefix = m[1] ?? "";
    const marker = m[2] ?? m[0] ?? "";
    const markerKey = normalizeFootnoteMarker(marker);
    const targetId = footnoteTargets.get(markerKey);
    const start = m.index! + prefix.length;
    // Digits with no matching footnote on the page stay plain text — superscripting
    // them turns ordinary inline numbers (years, counts) into fake footnote marks.
    if (targetId) {
      raw.push({ kind: "footnote", start, end: start + marker.length, marker, targetId });
    }
  }
  for (const m of text.matchAll(SHAMELA_DOUBLE_PAREN_REGEX)) {
    raw.push({ kind: "topic-paren", start: m.index!, end: m.index! + m[0].length, text: m[1]! });
  }
  for (const m of text.matchAll(SHAMELA_BRACKET_REGEX)) {
    const inner = m[1]!;
    // Skip anything with digits (verse refs [البقرة: 3], page refs, manuscript folios)
    if (/[\d٠-٩۰-۹]/.test(inner)) continue;
    // Require at least 5 base Arabic characters (strip diacritics for check)
    const baseChars = inner.replace(/[ً-ٟؐ-ؚۖ-ۭ\s]/g, "");
    if (baseChars.length < 5) continue;
    // Editor's apparatus notes ([سقط من الأصل], [كذا], [زيادة من خ]) are not topics
    if (EDITORIAL_BRACKET_REGEX.test(stripHarakat(inner))) continue;
    // Untrimmed so the rendered text aligns with source offsets for highlights
    raw.push({ kind: "topic-bracket", start: m.index!, end: m.index! + m[0].length, text: inner });
  }
  // Run attribution/enumeration regexes on harakat-stripped text so they match
  // regardless of whether the user has harakat display enabled.
  const { stripped: strippedText, map: harakatMap } = buildHarakatMap(text);
  for (const m of strippedText.matchAll(ENUM_LABEL_REGEX)) {
    const label = m[2]!;
    const sStart = m.index! + (m[1]?.length ?? 0);
    const sEnd = sStart + label.length;
    const start = harakatMap[sStart]!;
    const end = harakatMap[sEnd - 1]! + 1;
    raw.push({ kind: "enum-label", start, end, text: text.slice(start, end) });
  }
  for (const m of strippedText.matchAll(SPEAKER_ATTR_REGEX)) {
    const attr = m[2]!;
    const sStart = m.index! + (m[1]?.length ?? 0);
    const sEnd = sStart + attr.length;
    const start = harakatMap[sStart]!;
    const end = harakatMap[sEnd - 1]! + 1;
    raw.push({ kind: "speaker-attr", start, end, text: text.slice(start, end) });
  }
  raw.push(...collectPoetryTokens(text));

  // Sort by position, earliest first; on tie prefer the longer match
  raw.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping tokens (first one wins)
  const tokens: RichToken[] = [];
  let maxEnd = 0;
  for (const token of raw) {
    if (token.start >= maxEnd) {
      tokens.push(token);
      maxEnd = token.end;
    }
  }
  return tokens;
}

function renderReaderText(
  text: string,
  highlights: LocalHighlight[],
  footnoteTargets: Map<string, string>,
  language: "ar" | "de" | "en",
  onFootnoteReference: (id: string) => void,
  onHighlightSelect?: (highlight: LocalHighlight) => void,
  highlightActionLabel?: string,
  offsetBase = 0,
  chapterTitleAr?: string,
) {
  const tokens = collectRichTokens(text, footnoteTargets, chapterTitleAr);

  if (tokens.length === 0) {
    return renderHighlightedText(text, highlights, offsetBase, onHighlightSelect, highlightActionLabel);
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor) {
      const chunk = text.slice(cursor, token.start);
      nodes.push(
        <Fragment key={`text-${cursor}`}>
          {renderHighlightedText(chunk, highlights, offsetBase + cursor, onHighlightSelect, highlightActionLabel)}
        </Fragment>,
      );
    }

    // Saved highlights must render inside rich tokens too, so token contents pass
    // through renderHighlightedText with the offset of the content's first character.
    const highlightedTokenText = (content: string, contentStart: number) =>
      renderHighlightedText(content, highlights, offsetBase + contentStart, onHighlightSelect, highlightActionLabel);

    if (token.kind === "verse") {
      nodes.push(
        <span className="reader-quran-verse" key={`verse-${token.start}`}>
          {highlightedTokenText(token.verseText, token.start)}
        </span>,
      );
      if (token.ref) {
        nodes.push(
          <span className="reader-quran-ref" key={`verse-ref-${token.start}`}>
            {` [${token.ref}]`}
          </span>,
        );
      }
    } else if (token.kind === "heading") {
      nodes.push(
        <span className={headingCssClass(token.text)} key={`heading-${token.start}`}>
          {token.text}
        </span>,
      );
    } else if (token.kind === "topic-paren") {
      nodes.push(
        <span className="reader-topic-paren" key={`tp-${token.start}`}>
          {highlightedTokenText(token.text, token.start + 2)}
        </span>,
      );
    } else if (token.kind === "topic-bracket") {
      nodes.push(
        <span className="reader-topic-bracket" key={`tb-${token.start}`}>
          {highlightedTokenText(token.text, token.start + 1)}
        </span>,
      );
    } else if (token.kind === "enum-label") {
      nodes.push(
        <span className="reader-enum-label" key={`el-${token.start}`}>
          {highlightedTokenText(token.text, token.start)}
        </span>,
      );
    } else if (token.kind === "speaker-attr") {
      nodes.push(
        <span className="reader-speaker-attr" key={`sp-${token.start}`}>
          {highlightedTokenText(token.text, token.start)}
        </span>,
      );
    } else if (token.kind === "bayt") {
      const numText = text.slice(token.start, token.sadrStart);
      nodes.push(
        <span className="reader-bayt" key={`bayt-${token.start}`}>
          {numText.trim() ? <span className="reader-bayt-num">{numText}</span> : null}
          <span className="reader-bayt-sadr">
            {renderHighlightedText(
              text.slice(token.sadrStart, token.sadrEnd),
              highlights,
              offsetBase + token.sadrStart,
              onHighlightSelect,
              highlightActionLabel,
            )}
          </span>
          <span aria-hidden="true" className="reader-bayt-sep">
            {text.slice(token.sadrEnd, token.ajzStart)}
          </span>
          <span className="reader-bayt-ajz">
            {renderHighlightedText(
              text.slice(token.ajzStart, token.end),
              highlights,
              offsetBase + token.ajzStart,
              onHighlightSelect,
              highlightActionLabel,
            )}
          </span>
        </span>,
      );
    } else if (token.kind === "verse-divider") {
      nodes.push(
        <span aria-hidden="true" className="reader-verse-divider" key={`vd-${token.start}`}>
          {text.slice(token.start, token.end)}
        </span>,
      );
    } else if (token.kind === "suppress") {
      // consumed — render nothing; the range is just dropped (duplicate title)
    } else {
      nodes.push(
        <button
          aria-label={translateUi(language, "الانتقال إلى الحاشية {marker}", {
            marker: displayFootnoteMarker(token.marker),
          })}
          className="reader-footnote-ref"
          key={`fn-${token.start}`}
          onClick={() => onFootnoteReference(token.targetId)}
          type="button"
        >
          {displayFootnoteMarker(token.marker)}
        </button>,
      );
    }

    cursor = token.end;
  }

  if (cursor < text.length) {
    nodes.push(
      <Fragment key={`text-${cursor}`}>
        {renderHighlightedText(text.slice(cursor), highlights, offsetBase + cursor, onHighlightSelect, highlightActionLabel)}
      </Fragment>,
    );
  }

  return nodes;
}

// Splits fullText on double-newlines and renders each segment as a <p> element,
// preserving absolute highlight offsets via per-paragraph offsetBase tracking.
function renderParagraphs(
  fullText: string,
  highlights: LocalHighlight[],
  footnoteTargets: Map<string, string>,
  language: "ar" | "de" | "en",
  onFootnoteReference: (id: string) => void,
  onHighlightSelect?: (highlight: LocalHighlight) => void,
  highlightActionLabel?: string,
  chapterTitleAr?: string,
  paragraphOffset = 0,
): React.ReactNode[] {
  const parts: Array<{ text: string; offset: number }> = [];
  let lastEnd = 0;
  for (const m of fullText.matchAll(/\n\n+/g)) {
    parts.push({ text: fullText.slice(lastEnd, m.index), offset: lastEnd });
    lastEnd = m.index! + m[0].length;
  }
  parts.push({ text: fullText.slice(lastEnd), offset: lastEnd });

  const filtered = parts.filter(({ text }) => text.trim());

  return filtered.map(({ text, offset }, i) => {
    const prevText = i > 0 ? filtered[i - 1]!.text.trim() : "";
    const isBlockquote = BLOCK_ATTR_END_REGEX.test(stripHarakat(prevText));
    return (
      <p
        id={`p-${paragraphOffset + i}`}
        className={`reader-paragraph${isBlockquote ? " reader-blockquote" : ""}`}
        key={i}
      >
        {renderReaderText(
          text,
          highlights,
          footnoteTargets,
          language,
          onFootnoteReference,
          onHighlightSelect,
          highlightActionLabel,
          offset,
          chapterTitleAr,
        )}
      </p>
    );
  });
}

function buildPageFootnotes(
  pageId: number,
  parsedFootnotes: ParsedFootnote[],
): PageFootnote[] {
  const markerCounts = new Map<string, number>();

  return parsedFootnotes.map((footnote, index) => {
    const markerKey = normalizeFootnoteMarker(footnote.marker);
    const markerIndex = markerKey ? (markerCounts.get(markerKey) ?? 0) : 0;
    if (markerKey) markerCounts.set(markerKey, markerIndex + 1);

    const baseId = markerKey
      ? footnoteId(pageId, markerKey)
      : `reader-footnote-${pageId}-unmarked-${index}`;

    return {
      ...footnote,
      id: markerKey && markerIndex > 0 ? `${baseId}-${markerIndex + 1}` : baseId,
      markerKey,
    };
  });
}

function buildFootnoteTargets(footnotes: PageFootnote[]) {
  const targets = new Map<string, string>();
  for (const footnote of footnotes) {
    if (footnote.markerKey && !targets.has(footnote.markerKey)) {
      targets.set(footnote.markerKey, footnote.id);
    }
  }
  return targets;
}

export default function ChapterReader() {
  const { direction, language, t } = useUiTranslations();
  const [, navigate] = useLocation();
  const { bookId, chapterId, editionId, sectionId } = useParams<{
    bookId?: string;
    chapterId?: string;
    editionId?: string;
    sectionId?: string;
  }>();
  const bookIdNum = Number(editionId ?? bookId);
  const chapterIdNum = Number(sectionId ?? chapterId);
  const { data: book } = useStaticBook(bookIdNum);
  const { data: chapter, isLoading, isError, refetch } = useStaticBookChapter(bookIdNum, chapterIdNum);
  const cleanedChapterTitle = chapter
    ? chapter.type === "bab"
      ? cleanBabTitle(stripSectionTypePrefix(chapter.titleAr, chapter.type))
      : stripSectionTypePrefix(chapter.titleAr, chapter.type) || chapter.titleAr
    : "";
  useSeo(language, {
    canonicalPath: `/edition/${bookIdNum}/section/${chapterIdNum}`,
    description: chapter
      ? `${chapter.workTitle} - ${chapter.titleAr}. ${translateUi(language, "اقرأ النص الكامل مع الفهارس والحواشي.")}`
      : undefined,
    image: book?.coverImageUrl,
    jsonLd:
      book && chapter
        ? {
            "@context": "https://schema.org",
            "@type": "Chapter",
            inLanguage: language,
            isPartOf: {
              "@type": "Book",
              author: {
                "@type": "Person",
                name: language === "ar" ? "ابن قيم الجوزية" : "Ibn al-Qayyim",
              },
              name: book.titleAr,
            },
            name: chapter.titleAr,
            pagination: `${chapter.startPage}-${chapter.endPage}`,
          }
        : undefined,
    title: chapter ? `${chapter.titleAr} - ${chapter.workTitle}` : undefined,
    type: "article",
  });
  const { addHighlight, addNote, deleteHighlight, deletePosition, highlights, savePosition, settings, setSettings } = useLocalLibrary();
  const [tocOpen, setTocOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState<ReaderStatus>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(HIGHLIGHT_PALETTE[0].value);
  const highlightColorRef = useRef<HighlightColor>(HIGHLIGHT_PALETTE[0].value);
  const [selectedHighlight, setSelectedHighlight] = useState<LocalHighlight | null>(null);
  const [activeFootnoteId, setActiveFootnoteId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [appendedSectionIds, setAppendedSectionIds] = useState<number[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const highlightActionsRef = useRef<HTMLDivElement>(null);
  const { activeStepId, isTourOpen } = useOnboardingTour();
  const tourSelectionText = t("فإن في القلب شعثا لا يلمه إلا الإقبال على الله");

  const body = settings.showHarakat ? chapter?.content ?? "" : stripHarakat(chapter?.content ?? "");
  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  const chapters = book?.chapters ?? [];
  const currentIndex = chapters.findIndex((item) => item.id === chapterIdNum);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const lastAppendedId = appendedSectionIds.length > 0 ? appendedSectionIds[appendedSectionIds.length - 1] : chapterIdNum;
  const lastAppendedIndex = chapters.findIndex((c) => c.id === lastAppendedId);
  const nextAppendable = lastAppendedIndex >= 0 && lastAppendedIndex < chapters.length - 1 ? chapters[lastAppendedIndex + 1] : null;
  const bookProgress = useMemo(() => calculateBookPageProgress(book, chapter), [book, chapter]);

  const chapterHighlights = useMemo(
    () => highlights.filter((highlight) => highlight.chapterId === chapterIdNum),
    [chapterIdNum, highlights],
  );
  const positionedChapterHighlights = useMemo(
    () => chapterHighlights.filter(isPositionedHighlight),
    [chapterHighlights],
  );
  const showTourSelectionDemo = isTourOpen && activeStepId === "selection-actions";
  const showTourShareDemo =
    isTourOpen &&
    (activeStepId === "share-quote" || activeStepId === "customize-image" || activeStepId === "export-share");

  const renderedPages = useMemo(() => {
    const pages = chapter?.pages ?? [];
    if (pages.length === 0) {
      return [
        {
          id: chapter?.id ?? 0,
          pageNumber: chapter?.page ?? 0,
          sourcePageNumber: undefined,
          text: body,
          volume: "",
        },
      ];
    }
    return pages.map((page) => ({ ...page, text: settings.showHarakat ? page.text : stripHarakat(page.text) }));
  }, [body, chapter?.id, chapter?.page, chapter?.pages, settings.showHarakat]);

  const pageContent = useMemo(
    () =>
      renderedPages.map((page) => {
        const parsed = splitPageFootnotes(page.text);
        const footnotes = buildPageFootnotes(page.id, parsed.footnotes);
        const footnoteTargets = buildFootnoteTargets(footnotes);
        const visibleText = settings.showFootnotes
          ? [parsed.mainText, parsed.rawFootnotes].filter(Boolean).join("\n\n")
          : parsed.mainText;

        return {
          ...page,
          ...parsed,
          footnotes,
          footnoteTargets,
          visibleText,
        };
      }),
    [renderedPages, settings.showFootnotes],
  );

  const visibleBody = useMemo(() => pageContent.map((page) => page.visibleText).join("\n\n"), [pageContent]);

  const visibleReadingMinutes = useMemo(() => {
    const count = visibleBody.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(count / 180));
  }, [visibleBody]);
  const chapterDisplayPage = displayPageNumber(renderedPages[0]);

  const findMatches = useMemo<LocalHighlight[]>(() => {
    const query = normalizeFindQuery(findQuery);
    if (!findOpen || query.length < 2) return [];
    const matches: LocalHighlight[] = [];
    for (const page of pageContent) {
      const { stripped, map } = buildHarakatMap(page.mainText);
      const haystack = unifyArabicChars(stripped).toLowerCase();
      let searchFrom = 0;
      while (matches.length < MAX_FIND_MATCHES) {
        const found = haystack.indexOf(query, searchFrom);
        if (found === -1) break;
        const endStripped = found + query.length;
        matches.push({
          bookId: bookIdNum,
          bookTitle: "",
          chapterId: chapterIdNum,
          chapterTitle: "",
          color: FIND_MATCH_COLOR,
          createdAt: 0,
          endOffset: endStripped < map.length ? map[endStripped]! : page.mainText.length,
          id: `${FIND_MATCH_ID_PREFIX}${page.id}:${found}`,
          pageId: page.id,
          startOffset: map[found]!,
          surface: "main",
          text: "",
        });
        searchFrom = found + 1;
      }
      if (matches.length >= MAX_FIND_MATCHES) break;
    }
    return matches;
  }, [bookIdNum, chapterIdNum, findOpen, findQuery, pageContent]);

  const activeFindIndex = findMatches.length > 0 ? Math.min(findIndex, findMatches.length - 1) : 0;
  const styledFindMatches = useMemo(
    () =>
      findMatches.map((match, index) =>
        index === activeFindIndex ? { ...match, color: FIND_ACTIVE_MATCH_COLOR } : match,
      ),
    [activeFindIndex, findMatches],
  );

  const stepFindMatch = useCallback(
    (delta: number) => {
      setFindIndex((current) => {
        if (findMatches.length === 0) return 0;
        const base = Math.min(current, findMatches.length - 1);
        return (base + delta + findMatches.length) % findMatches.length;
      });
    },
    [findMatches.length],
  );

  useEffect(() => {
    if (!findOpen || findMatches.length === 0) return;
    const active = findMatches[Math.min(findIndex, findMatches.length - 1)];
    if (!active) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-reader-highlight-id="${CSS.escape(active.id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [findIndex, findMatches, findOpen]);

  const scrollToFootnote = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    });
  }, []);

  const scrollToTop = useCallback(() => {
    document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
    document.body.scrollTo?.({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleFootnoteReference = useCallback(
    (id: string) => {
      setActiveFootnoteId(id);
      if (!settings.showFootnotes) {
        setSettings((current) => ({ ...current, showFootnotes: true }));
      }
    },
    [setSettings, settings.showFootnotes],
  );

  const showStatus = (nextStatus: ReaderStatus) => {
    setStatus(nextStatus);
    window.setTimeout(() => setStatus(null), 1800);
  };

  const saveCurrentPosition = useCallback(() => {
    if (!chapter || !book) return;
    savePosition({
      bookId: book.id,
      bookTitle: book.titleAr,
      chapterId: chapter.id,
      chapterTitle: cleanedChapterTitle,
      progress: bookProgress,
      savedAt: Date.now(),
      scrollY: window.scrollY,
      workId: book.workId,
      workTitle: book.workTitleAr,
    });
  }, [book, bookProgress, chapter, savePosition]);

  useEffect(() => {
    const interval = window.setInterval(saveCurrentPosition, 3000);
    return () => window.clearInterval(interval);
  }, [saveCurrentPosition]);

  useEffect(() => {
    if (!isError || !book || !Number.isFinite(chapterIdNum)) return;
    if (book.firstChapterId === chapterIdNum) return;

    deletePosition(chapterIdNum);
    navigate(`/edition/${book.id}/section/${book.firstChapterId}`, {
      replace: true,
    });
  }, [book, chapterIdNum, deletePosition, isError, navigate]);

  useEffect(() => {
    clearSelection();
    setSelectedHighlight(null);
    setActiveFootnoteId(null);
    setAppendedSectionIds([]);
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
  }, [chapterIdNum]);

  // Mark the document while reader is mounted so CSS transitions are active on header/nav
  useEffect(() => {
    document.documentElement.classList.add("reader-focus-ready");
    return () => {
      document.documentElement.classList.remove("reader-focus-ready");
      document.documentElement.classList.remove("focus-mode-active");
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (focusMode) {
      document.documentElement.classList.add("focus-mode-active");
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.documentElement.classList.remove("focus-mode-active");
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [focusMode]);

  // Sync focus mode state when browser exits fullscreen (Esc / F11 / clicking browser chrome)
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const updateScrollTopVisibility = () => {
      setShowScrollTop(currentScrollY() > scrollTopThreshold());
    };

    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, [bookIdNum, chapterIdNum]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (event.target as HTMLElement).isContentEditable;
      if (isTyping) return;

      if (event.key === "Escape") {
        if (focusMode) { setFocusMode(false); return; }
        if (findOpen) { setFindOpen(false); return; }
        setTocOpen(false);
        clearSelection();
        setSelectedHighlight(null);
        return;
      }

      if (event.key === "t" || event.key === "T") {
        setTocOpen((open) => !open);
        return;
      }

      if (event.key === "f" || event.key === "F") {
        setFocusMode((m) => !m);
        return;
      }

      const isNextKey = direction === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
      const isPrevKey = direction === "rtl" ? event.key === "ArrowRight" : event.key === "ArrowLeft";

      if (isNextKey && next && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        navigate(`/edition/${next.editionId}/section/${next.id}`);
        window.scrollTo({ top: 0 });
        return;
      }
      if (isPrevKey && prev && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        navigate(`/edition/${prev.editionId}/section/${prev.id}`);
        window.scrollTo({ top: 0 });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [direction, findOpen, focusMode, navigate, next, prev]);

  useEffect(() => {
    if (!activeFootnoteId || !settings.showFootnotes) return;
    scrollToFootnote(activeFootnoteId);
    const timeout = window.setTimeout(() => {
      setActiveFootnoteId((current) => (current === activeFootnoteId ? null : current));
    }, FOOTNOTE_FOCUS_MS);
    return () => window.clearTimeout(timeout);
  }, [activeFootnoteId, scrollToFootnote, settings.showFootnotes]);

  useEffect(() => {
    const onSelection = () => {
      const currentSelection = window.getSelection();
      const selected = currentSelection?.toString().trim() ?? "";
      const anchor = currentSelection?.anchorNode;
      if (selected.length > 1 && currentSelection && anchor && contentRef.current?.contains(anchor)) {
        setSelectedHighlight(null);
        setSelection(selected);
        setSelectionPosition(getSelectionPosition(currentSelection, contentRef.current));
      }
    };
    document.addEventListener("mouseup", onSelection);
    document.addEventListener("touchend", onSelection);
    return () => {
      document.removeEventListener("mouseup", onSelection);
      document.removeEventListener("touchend", onSelection);
    };
  }, []);

  useEffect(() => {
    if (!selection) return;

    const onPointerDown = (event: PointerEvent) => {
      if (selectionToolbarRef.current?.contains(event.target as Node)) return;
      clearSelection();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) clearSelection();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [selection]);

  useEffect(() => {
    if (!selectedHighlight) return;

    const onPointerDown = (event: PointerEvent) => {
      if (highlightActionsRef.current?.contains(event.target as Node)) return;
      setSelectedHighlight(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedHighlight]);

  const selectionPayload = () => ({
    bookId: book!.id,
    bookTitle: book!.titleAr,
    chapterId: chapter!.id,
    chapterTitle: cleanedChapterTitle,
    text: selection,
  });

  const highlightPayload = () => {
    if (!selectionPosition) return null;
    return {
      ...selectionPayload(),
      ...selectionPosition,
      color: highlightColorRef.current,
    };
  };

  const clearSelection = () => {
    setSelection("");
    setSelectionPosition(null);
    setNoteDraft("");
    window.getSelection()?.removeAllRanges();
  };

  const selectHighlightColor = (color: HighlightColor) => {
    highlightColorRef.current = color;
    setHighlightColor(color);
  };

  const handleHighlightSelect = useCallback((highlight: LocalHighlight) => {
    if (highlight.id.startsWith(FIND_MATCH_ID_PREFIX)) return;
    clearSelection();
    setSelectedHighlight(highlight);
  }, []);

  const handleCopyChapter = async () => {
    if (!book || !chapter) return;
    await copyText(buildShareText(visibleBody, book.titleAr, cleanedChapterTitle, language));
    showStatus("copied");
  };

  const handleCopySelection = async () => {
    await copyText(buildShareText(selection, book!.titleAr, chapter!.titleAr, language));
    showStatus("copied");
  };

  const handleSavePosition = () => {
    saveCurrentPosition();
    showStatus("saved");
  };

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (isError || !chapter || !book) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl px-5 py-16">
          <ErrorState retry={() => refetch()} title="تعذر تحميل الفصل" />
        </main>
      </AppShell>
    );
  }

  const isTranslation = book.kind === "translation";
  const readerTextStyle: CSSProperties = {
    fontFamily,
    fontSize: settings.fontSize,
  };
  const sourceEditUrl = isTranslation && book.sourceFile ? buildSourceEditUrl(book.sourceFile) : null;
  const buildCorrectionUrl = (selectedText?: string) => {
    const relatedPage =
      selectedText && selectedText.trim()
        ? pageContent.find((page) => page.visibleText.includes(selectedText.trim())) ?? pageContent[0]
        : pageContent[0];

    return buildTranslationIssueUrl({
      currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
      editionId: book.id,
      editionTitle: book.titleAr,
      language,
      pageNumber: relatedPage?.pageNumber,
      sectionId: chapter.id,
      sectionTitle: chapter.titleAr,
      selectedText,
      sourceFile: book.sourceFile,
      sourcePageNumber: relatedPage?.sourcePageNumber,
      workTitle: book.workTitleAr,
    });
  };

  return (
    <AppShell>
      <main
        className="scholarly-bg min-h-screen px-0 pb-[15rem] pt-4 sm:px-4 sm:pb-40 sm:pt-6 md:px-6"
        id="main-content"
      >
        <div className="mx-auto max-w-6xl">
          <article className="reader-surface surface-card mx-auto min-w-0 max-w-6xl" data-tour="reader-text">
            <div className="reader-chrome sticky top-14 z-30 rounded-none border-x-0 border-t-0">
              <div className="flex h-14 items-center justify-between gap-2 px-2.5 sm:gap-3 sm:px-4">
                <button
                  onClick={() => setTocOpen(true)}
                  className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                  aria-label={t("المحتويات")}
                >
                  <Menu className="h-4 w-4" />
                </button>
                <Link
                  aria-label={t("العودة إلى الكتاب")}
                  className="min-w-0 flex-1 text-center transition-colors hover:text-muted-foreground"
                  href={`/edition/${book.id}`}
                >
                  <p className="truncate text-sm font-semibold">{book.titleAr}</p>
                  <p className="truncate text-xs text-muted-foreground">{cleanedChapterTitle}</p>
                </Link>
                <div className="flex items-center gap-1 text-muted-foreground">
                  {prev && (
                    <Link
                      href={`/edition/${prev.editionId}/section/${prev.id}`}
                      className="reader-control hidden h-11 w-11 items-center justify-center sm:inline-flex sm:h-10 sm:w-10"
                      aria-label={t("الفصل السابق")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Link>
                  )}
                  {next && (
                    <Link
                      href={`/edition/${next.editionId}/section/${next.id}`}
                      className="reader-control hidden h-11 w-11 items-center justify-center sm:inline-flex sm:h-10 sm:w-10"
                      aria-label={t("الفصل التالي")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Link>
                  )}
                  <button
                    onClick={handleSavePosition}
                    className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                    aria-label={t("حفظ موضع القراءة")}
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyChapter}
                    data-tour="reader-copy-chapter"
                    className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                    aria-label={t("نسخ الفصل")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setFindOpen((open) => !open)}
                    className="reader-control inline-flex h-11 w-11 items-center justify-center data-[active=true]:bg-muted sm:h-10 sm:w-10"
                    data-active={findOpen}
                    aria-expanded={findOpen}
                    aria-label={t("البحث داخل هذا القسم")}
                    type="button"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 px-3 pb-3 text-xs text-muted-foreground sm:px-4">
                <span className="tabular-nums">{Math.round(bookProgress)}%</span>
                <ProgressLine className="flex-1" showValue={false} value={bookProgress} />
                {chapterDisplayPage > 0 && (
                  <span className="shrink-0 tabular-nums">{pageText(chapterDisplayPage, language)}</span>
                )}
              </div>
              {findOpen && (
                <div className="flex items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input
                    autoFocus
                    aria-label={t("البحث داخل هذا القسم")}
                    className="h-9 w-full min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm focus:border-foreground focus:outline-none"
                    dir={direction}
                    onChange={(event) => {
                      setFindQuery(event.target.value);
                      setFindIndex(0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setFindOpen(false);
                        return;
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        stepFindMatch(event.shiftKey ? -1 : 1);
                      }
                    }}
                    placeholder={t("البحث داخل هذا القسم")}
                    value={findQuery}
                  />
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {normalizeFindQuery(findQuery).length >= 2
                      ? findMatches.length > 0
                        ? `${activeFindIndex + 1} / ${findMatches.length}`
                        : t("لا نتائج")
                      : ""}
                  </span>
                  <button
                    onClick={() => stepFindMatch(-1)}
                    disabled={findMatches.length === 0}
                    className="reader-control inline-flex h-9 w-9 items-center justify-center disabled:opacity-35"
                    aria-label={t("النتيجة السابقة")}
                    type="button"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => stepFindMatch(1)}
                    disabled={findMatches.length === 0}
                    className="reader-control inline-flex h-9 w-9 items-center justify-center disabled:opacity-35"
                    aria-label={t("النتيجة التالية")}
                    type="button"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/search?target=section&editionId=${book.id}&sectionId=${chapter.id}`}
                    className="hidden shrink-0 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline"
                  >
                    {t("البحث في كل الكتاب")}
                  </Link>
                  <button
                    onClick={() => setFindOpen(false)}
                    className="reader-control inline-flex h-9 w-9 items-center justify-center"
                    aria-label={t("إغلاق البحث")}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <header className="reader-header mx-auto max-w-4xl border-b border-border px-4 py-5 text-center sm:px-6 sm:py-8 md:px-12 md:py-10">
              {chapter.type !== "heading" && chapter.type !== "topic" && (
                <div className="flourish-rule mb-4 text-muted-foreground/50" style={{ gap: "0.55rem" }}>
                  <span className="flourish-rule__ornament flourish-rule__ornament--hollow" />
                  <span className="shrink-0 text-xs font-semibold tracking-widest">
                    {sectionTypeLabel(chapter.type, language)}
                  </span>
                  <span className="flourish-rule__ornament flourish-rule__ornament--hollow" />
                </div>
              )}
              <h1 className="mx-auto max-w-3xl font-display text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                {cleanedChapterTitle}
              </h1>
              <p className="mt-4 text-sm text-muted-foreground tabular-nums">
                {readingMetaText(visibleReadingMinutes, chapterDisplayPage, language)}
              </p>
              {isTranslation && (
                <div className="mt-5 flex flex-col justify-center gap-2 sm:mt-6 sm:flex-row sm:flex-wrap">
                  <a
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:h-10"
                    href={buildCorrectionUrl()}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MessageSquareWarning className="h-4 w-4" />
                    {t("اقتراح تصحيح")}
                  </a>
                  {sourceEditUrl && (
                    <a
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-foreground sm:h-10"
                      href={sourceEditUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Github className="h-4 w-4" />
                      {t("تعديل ملف الترجمة على GitHub")}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  )}
                </div>
              )}
            </header>

            <div className="mx-auto max-w-4xl px-8 pb-1 pt-5 text-muted-foreground/25">
              <div className="flourish-rule">
                <span className="flourish-rule__ornament" />
              </div>
            </div>

            <div
              ref={contentRef}
              key={chapterIdNum}
              data-tour="reader-selection"
              className="reader-text reader-fade-in mx-auto mt-3 px-4 pb-8 text-start leading-[2.25] text-foreground sm:mt-4 sm:px-8 sm:leading-[2.45] md:px-10 lg:px-12"
              dir={chapter.direction}
              style={readerTextStyle}
            >
              {visibleBody ? (
                (() => {
                  let paragraphCounter = 0;
                  return pageContent.map((page) => {
                    const pageText_ = settings.showPageMarkers ? page.mainText : page.mainText.trimEnd();
                    const paragraphCount = pageText_.split(/\n\n+/).filter((s) => s.trim()).length;
                    const pageParaOffset = paragraphCounter;
                    paragraphCounter += paragraphCount;
                    return (
                  <section
                    className={settings.showPageMarkers ? "mb-8 scroll-mt-32 sm:mb-10" : "scroll-mt-32"}
                    id={`page-${page.pageNumber}`}
                    key={page.id}
                  >
                    {settings.showPageMarkers && (
                      <div className="reader-page-marker my-6 flex items-center gap-3 text-muted-foreground/40 sm:my-8">
                        <span className="h-px flex-1 bg-border/50" />
                        <span className="text-[0.65rem] tabular-nums tracking-wide">
                          {pageText(displayPageNumber(page), language)}
                          {page.volume ? ` · ${page.volume}` : ""}
                        </span>
                        <span className="h-px flex-1 bg-border/50" />
                      </div>
                    )}
                    <div data-reader-highlight-surface="main" data-reader-page-id={page.id}>
                      {renderParagraphs(
                        pageText_,
                        [
                          ...positionedChapterHighlights.filter(
                            (highlight) => highlight.pageId === page.id && highlight.surface === "main",
                          ),
                          ...styledFindMatches.filter((match) => match.pageId === page.id),
                        ],
                        page.footnoteTargets,
                        language,
                        handleFootnoteReference,
                        handleHighlightSelect,
                        t("حذف التظليل"),
                        chapter.titleAr,
                        pageParaOffset,
                      )}
                    </div>
                    {settings.showFootnotes && (
                      <PageFootnotes
                        activeFootnoteId={activeFootnoteId}
                        footnotes={page.footnotes}
                        highlights={positionedChapterHighlights.filter(
                          (highlight) => highlight.pageId === page.id && highlight.surface === "footnote",
                        )}
                        onHighlightSelect={handleHighlightSelect}
                        pageId={page.id}
                      />
                    )}
                  </section>
                    );
                  });
                })()
              ) : (
                t("لا يوجد نص متاح لهذا الفصل بعد.")
              )}
            </div>

            {appendedSectionIds.map((sectionId) => (
              <AppendedSection
                key={sectionId}
                activeFootnoteId={activeFootnoteId}
                bookId={bookIdNum}
                highlights={highlights}
                language={language}
                onFootnoteReference={handleFootnoteReference}
                onHighlightSelect={handleHighlightSelect}
                sectionId={sectionId}
                settings={settings}
              />
            ))}

            {nextAppendable && (
              <div className="mx-auto max-w-4xl px-4 py-6 text-center sm:px-6">
                <button
                  onClick={() => setAppendedSectionIds((ids) => [...ids, nextAppendable.id])}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                  {t("تحميل القسم التالي")}
                </button>
              </div>
            )}

            <footer className="mx-auto mt-4 grid max-w-5xl gap-3 border-t border-border px-4 pb-8 pt-5 sm:mt-8 sm:grid-cols-2 sm:px-6 sm:pt-6">
              {prev ? <ChapterNav chapter={prev} label={t("الفصل السابق")} role="back" /> : <span />}
              {nextAppendable ? <ChapterNav chapter={nextAppendable} label={t("الفصل التالي")} role="forward" /> : <span />}
            </footer>
          </article>
        </div>
      </main>

      <ReaderToolbar
        bookProgress={bookProgress}
        isFocusMode={focusMode}
        onToc={() => setTocOpen(true)}
        onToggleFocus={() => setFocusMode((m) => !m)}
        settings={settings}
        setSettings={setSettings}
      />

      <FocusModeOverlay isFocusMode={focusMode} />

      {showScrollTop && (
        <button
          aria-label={t("الصعود للأعلى")}
          className="reader-bar-bottom reader-chrome fixed start-3 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full shadow-md transition hover:-translate-y-0.5 hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground md:start-4"
          onClick={scrollToTop}
          type="button"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {showTourSelectionDemo && <TourSelectionActionsDemo text={tourSelectionText} />}

      {status && (
        <div
          className="reader-bar-above reader-chrome fixed left-1/2 z-[55] -translate-x-1/2 rounded-md px-4 py-2 text-sm font-semibold"
        >
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {status === "copied" && t("تم النسخ")}
            {status === "highlightDeleted" && t("تم حذف التظليل")}
            {status === "highlighted" && t("تم حفظ التظليل")}
            {status === "noted" && t("تم حفظ الملاحظة")}
            {status === "saved" && t("تم حفظ الموضع")}
          </span>
        </div>
      )}

      {selection && (
        <div
          ref={selectionToolbarRef}
          className="reader-bar-above reader-chrome fixed left-1/2 z-50 max-h-[50vh] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-lg p-3 md:max-h-none"
        >
          <div className="flex items-start gap-3">
            <p className="line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">{selection}</p>
            <button
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("إغلاق")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder={t("ملاحظة اختيارية")}
            className="mt-3 h-20 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-foreground focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t("لون التظليل")}</span>
            <div className="flex items-center gap-1">
              {HIGHLIGHT_PALETTE.map((color) => (
                <button
                  aria-label={`${t("تظليل")} ${t(color.name)}`}
                  aria-pressed={highlightColor === color.value}
                  className="h-7 w-7 rounded-full border border-border ring-offset-2 ring-offset-background transition hover:scale-105 data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
                  data-selected={highlightColor === color.value}
                  key={color.value}
                  onClick={() => selectHighlightColor(color.value)}
                  onPointerDown={(event) => event.preventDefault()}
                  style={{ background: color.bg }}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => {
                const nextHighlight = highlightPayload();
                if (!nextHighlight) return;
                addHighlight(nextHighlight);
                showStatus("highlighted");
                clearSelection();
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectionPosition}
            >
              <Highlighter className="h-4 w-4" />
              {t("تظليل")}
            </button>
            <button
              onClick={() => {
                addNote({ ...selectionPayload(), note: noteDraft || selection, selectedText: selection });
                showStatus("noted");
                clearSelection();
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
            >
              <StickyNote className="h-4 w-4" />
              {t("حفظ ملاحظة")}
            </button>
            <button
              onClick={handleCopySelection}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              {t("نسخ")}
            </button>
            <button
              onClick={() => setShareText(selection)}
              data-tour="reader-share-selection"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Share2 className="h-4 w-4" />
              {t("مشاركة")}
            </button>
            {isTranslation && (
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground sm:justify-start"
                href={buildCorrectionUrl(selection)}
                rel="noreferrer"
                target="_blank"
              >
                <MessageSquareWarning className="h-4 w-4" />
                {t("اقتراح تصحيح")}
              </a>
            )}
          </div>
        </div>
      )}

      {selectedHighlight && !selection && (
        <div
          ref={highlightActionsRef}
          className="reader-bar-above reader-chrome fixed left-1/2 z-50 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-lg p-3"
        >
          <div className="flex items-start gap-3">
            <p
              className="reader-highlight line-clamp-2 flex-1 rounded-md px-3 py-2 text-sm leading-7"
              style={getHighlightStyle(selectedHighlight.color)}
            >
              {selectedHighlight.text}
            </p>
            <button
              onClick={() => setSelectedHighlight(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("إغلاق")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => {
              deleteHighlight(selectedHighlight.id);
              setSelectedHighlight(null);
              showStatus("highlightDeleted");
            }}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground hover:bg-muted sm:w-auto"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {t("حذف التظليل")}
          </button>
        </div>
      )}

      {(shareText || showTourShareDemo) && (
        <QuoteShareModal
          bookTitle={book.titleAr}
          chapterTitle={cleanedChapterTitle}
          pageNumber={chapter.page > 0 ? chapter.page : undefined}
          onClose={() => setShareText(null)}
          text={shareText ?? tourSelectionText}
        />
      )}

      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent
          side={direction === "rtl" ? "right" : "left"}
          className="w-full max-w-full overflow-y-auto sm:max-w-md lg:max-w-lg"
          dir={direction}
        >
          <SheetHeader>
            <SheetTitle>{t("المحتويات")}</SheetTitle>
          </SheetHeader>
          <ReaderToc
            bookId={book.id}
            bookTitle={book.titleAr}
            chapterId={chapter.id}
            chapters={chapters}
            onSelect={() => setTocOpen(false)}
            pages={book.pages}
          />
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function AppendedSection({
  activeFootnoteId,
  bookId,
  highlights,
  language,
  onFootnoteReference,
  onHighlightSelect,
  sectionId,
  settings,
}: {
  activeFootnoteId: string | null;
  bookId: number;
  highlights: LocalHighlight[];
  language: "ar" | "de" | "en";
  onFootnoteReference: (id: string) => void;
  onHighlightSelect: (highlight: LocalHighlight) => void;
  sectionId: number;
  settings: ReaderSettings;
}) {
  const { t } = useUiTranslations();
  const { data: chapter, isLoading } = useStaticBookChapter(bookId, sectionId);

  const renderedPages = useMemo(() => {
    if (!chapter) return [];
    const pages = chapter.pages ?? [];
    if (pages.length === 0) {
      return [{ id: chapter.id ?? 0, pageNumber: chapter.page ?? 0, sourcePageNumber: undefined, text: settings.showHarakat ? chapter.content : stripHarakat(chapter.content), volume: "" }];
    }
    return pages.map((page) => ({ ...page, text: settings.showHarakat ? page.text : stripHarakat(page.text) }));
  }, [chapter, settings.showHarakat]);

  const pageContent = useMemo(
    () =>
      renderedPages.map((page) => {
        const parsed = splitPageFootnotes(page.text);
        const footnotes = buildPageFootnotes(page.id, parsed.footnotes);
        const footnoteTargets = buildFootnoteTargets(footnotes);
        const visibleText = settings.showFootnotes
          ? [parsed.mainText, parsed.rawFootnotes].filter(Boolean).join("\n\n")
          : parsed.mainText;
        return { ...page, ...parsed, footnotes, footnoteTargets, visibleText };
      }),
    [renderedPages, settings.showFootnotes],
  );

  const positionedHighlights = useMemo(
    () => highlights.filter((h) => h.chapterId === sectionId && isPositionedHighlight(h)),
    [highlights, sectionId],
  );

  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";
  const readerTextStyle: CSSProperties = {
    fontFamily,
    fontSize: settings.fontSize,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (!chapter) return null;

  return (
    <>
      <header className="reader-header mx-auto max-w-4xl border-y border-border px-4 py-7 text-center sm:px-6 sm:py-10 md:px-12 md:py-14">
        <h2 className="mx-auto max-w-3xl font-display text-2xl font-bold leading-tight sm:text-3xl md:text-5xl">
          {chapter.titleAr}
        </h2>
      </header>
      <div
        className="reader-text mx-auto mt-6 px-4 pb-8 text-start leading-[2.25] text-foreground sm:mt-8 sm:px-8 sm:leading-[2.45] md:px-10 lg:px-12"
        dir={chapter.direction}
        style={readerTextStyle}
      >
        {pageContent.map((page) => (
          <section
            className={settings.showPageMarkers ? "mb-8 scroll-mt-32 sm:mb-10" : "scroll-mt-32"}
            id={`page-${page.pageNumber}`}
            key={page.id}
          >
            {settings.showPageMarkers && (
              <div className="reader-page-marker my-6 flex items-center gap-3 text-muted-foreground/40 sm:my-8">
                <span className="h-px flex-1 bg-border/50" />
                <span className="text-[0.65rem] tabular-nums tracking-wide">
                  {pageText(displayPageNumber(page), language)}
                  {page.volume ? ` · ${page.volume}` : ""}
                </span>
                <span className="h-px flex-1 bg-border/50" />
              </div>
            )}
            <div data-reader-highlight-surface="main" data-reader-page-id={page.id}>
              {renderParagraphs(
                settings.showPageMarkers ? page.mainText : page.mainText.trimEnd(),
                positionedHighlights.filter((h) => h.pageId === page.id && h.surface === "main"),
                page.footnoteTargets,
                language,
                onFootnoteReference,
                onHighlightSelect,
                t("حذف التظليل"),
                chapter.titleAr,
              )}
            </div>
            {settings.showFootnotes && (
              <PageFootnotes
                activeFootnoteId={activeFootnoteId}
                footnotes={page.footnotes}
                highlights={positionedHighlights.filter((h) => h.pageId === page.id && h.surface === "footnote")}
                onHighlightSelect={onHighlightSelect}
                pageId={page.id}
              />
            )}
          </section>
        ))}
      </div>
    </>
  );
}
