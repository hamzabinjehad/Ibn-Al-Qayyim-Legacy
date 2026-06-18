// Arabic diacritics (tashkeel) range for dynamic regexes
const D = "[ً-ٟؐ-ؚۖ-ۭ]*";

// Strip the redundant type-word prefix from a section title.
// Avoids double-labeling when the type badge already labels the entry.
//   "فَصْلٌ فِي ذِكْرِ الأنوار"  →  "فِي ذِكْرِ الأنوار"
//   "الباب الثاني: في حقيقة مرض القلب"  →  "الثاني: في حقيقة مرض القلب"
export function stripSectionTypePrefix(title: string, type: string): string {
  if (!title) return title;
  if (type === "fasl") {
    const re = new RegExp(`^ف${D}ص${D}ل${D}[\\s:،.ٌ]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "bab") {
    const re = new RegExp(`^ا${D}ل${D}ب${D}ا${D}ب${D}\\s+`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "masala") {
    const re = new RegExp(`^م${D}س${D}[أئ]${D}ل${D}ة${D}[\\s:،.]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "faida") {
    const re = new RegExp(`^ف${D}ا${D}ئ${D}د${D}ة${D}[\\s:،.]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "qaida") {
    const re = new RegExp(`^ق${D}ا${D}ع${D}د${D}ة${D}[\\s:،.]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "tanbih") {
    const re = new RegExp(`^ت${D}ن${D}ب${D}ي${D}ه${D}[\\s:،.]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  if (type === "matlub") {
    const re = new RegExp(`^م${D}ط${D}ل${D}ب${D}[\\s:،.]*`, "u");
    const m = title.match(re);
    if (m && m[0].length < title.length) return title.slice(m[0].length).trim();
  }
  return title;
}

// Remove prose content appended to bab titles during extraction.
// Call after stripSectionTypePrefix.
export function cleanBabTitle(title: string): string {
  if (!title) return title;

  // 0. Strip manuscript page refs: "[21 أ]", "[5 ب]"
  let t = title.replace(/\s*\[\d+\s*[أبجدهوزحط]\]/gu, "").trim();

  // 1. Concatenated chapter refs: ". الباب X" / "… الباب X" / "… لباب X"
  const concatM = t.match(/[.،…]\s*(?:الباب|لباب)\s+/u);
  if (concatM?.index && concatM.index > 2) return t.slice(0, concatM.index).trim();

  // 2. "هذا الباب" always starts a content discussion, never the title itself
  const habM = t.match(/\s+هذا\s+الباب\b/u);
  if (habM?.index) return t.slice(0, habM.index).trim();

  // 3. Period followed by typical Arabic prose-starters
  const periodM = t.match(/\s*[.]\s+(?:لما|قال\s+(?:الله|تعالى)|هذا|هذه|وذلك|فذلك|ومن\s+هاهنا)/u);
  if (periodM?.index && periodM.index > 4) return t.slice(0, periodM.index).trim();

  // 4. "لما كان" explanatory clause mid-title without a preceding period
  const lammaM = t.match(/\s+لما\s+كان\s+/u);
  if (lammaM?.index && lammaM.index > 8) return t.slice(0, lammaM.index).trim();

  // 5. "قال الله" / "قال تعالى" Quranic citation without a period
  const qalaM = t.match(/\s+قال\s+(?:الله|تعالى)\s+/u);
  if (qalaM?.index && qalaM.index > 8) return t.slice(0, qalaM.index).trim();

  return t;
}

// Safe subset for contexts where section type is unavailable (e.g. search results).
// Only applies patterns that are unambiguously bab-specific.
export function cleanSectionTitleForDisplay(title: string): string {
  if (!title) return title;
  const concatM = title.match(/[.،…]\s*(?:الباب|لباب)\s+/u);
  if (concatM?.index && concatM.index > 2) return title.slice(0, concatM.index).trim();
  const habM = title.match(/\s+هذا\s+الباب\b/u);
  if (habM?.index) return title.slice(0, habM.index).trim();
  return title;
}
