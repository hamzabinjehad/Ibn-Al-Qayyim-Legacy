// Export utilities for highlights and notes
// PDF uses jsPDF + html2canvas (loaded dynamically to avoid bundle bloat)

export interface ExportHighlight {
  id: number;
  chapterId: number;
  selectedText: string;
  color: string;
  createdAt: string;
  chapterTitleAr: string;
  chapterOrder: number;
  bookId: number;
  bookTitleAr: string;
}

export interface ExportNote {
  id: number;
  chapterId: number;
  content: string;
  selectedText: string | null;
  createdAt: string;
  updatedAt: string;
  chapterTitleAr: string;
  chapterOrder: number;
  bookId: number;
  bookTitleAr: string;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function citation(
  bookTitleAr: string,
  chapterTitleAr: string,
  chapterOrder: number,
  createdAt: string
) {
  const date = new Date(createdAt).toLocaleDateString("ar-SA");
  return `ابن قيم الجوزية، ${bookTitleAr}، الفصل ${chapterOrder} (${chapterTitleAr})، ${date}`;
}

// ── Plain Text ──────────────────────────────────────────────────────────────

export function exportHighlightsText(highlights: ExportHighlight[]) {
  const lines = highlights.map(
    (h) =>
      `${h.selectedText}\n\n` +
      `— ${citation(h.bookTitleAr, h.chapterTitleAr, h.chapterOrder, h.createdAt)}`
  );
  downloadBlob(lines.join("\n\n━━━━━\n\n"), "تظليلاتي.txt", "text/plain;charset=utf-8");
}

export function exportNotesText(notes: ExportNote[]) {
  const lines = notes.map((n) => {
    const quoted = n.selectedText ? `"${n.selectedText}"\n\n` : "";
    return (
      `${quoted}` +
      `ملاحظتي: ${n.content}\n\n` +
      `— ${citation(n.bookTitleAr, n.chapterTitleAr, n.chapterOrder, n.createdAt)}`
    );
  });
  downloadBlob(lines.join("\n\n━━━━━\n\n"), "ملاحظاتي.txt", "text/plain;charset=utf-8");
}

// ── DOCS (Word-compatible HTML → .doc) ─────────────────────────────────────

const WORD_STYLES = `
  @page { size: A4; margin: 2.5cm; }
  body {
    font-family: 'Traditional Arabic', 'Times New Roman', serif;
    font-size: 14pt;
    direction: rtl;
    text-align: right;
    color: #1a1a1a;
    line-height: 1.9;
  }
  h1 {
    font-size: 20pt;
    text-align: center;
    color: #5a3e2b;
    border-bottom: 2px solid #c9a96e;
    padding-bottom: 8pt;
    margin-bottom: 24pt;
  }
  .entry { margin-bottom: 22pt; page-break-inside: avoid; }
  .text { font-size: 15pt; margin-bottom: 8pt; }
  .quoted {
    font-style: italic;
    color: #444;
    border-right: 3px solid #bbb;
    padding-right: 10pt;
    margin-bottom: 6pt;
  }
  .note-label { font-size: 10pt; color: #888; }
  .citation {
    font-size: 10pt;
    color: #666;
    border-right: 3px solid #c9a96e;
    padding-right: 8pt;
    margin-top: 6pt;
  }
  hr { border: none; border-top: 1px solid #e0d4c4; margin: 18pt 0; }
`;

function wordDocument(title: string, bodyHtml: string) {
  return (
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' ` +
    `xmlns:w='urn:schemas-microsoft-com:office:word' ` +
    `xmlns='http://www.w3.org/TR/REC-html40'>` +
    `<head><meta charset='utf-8'><title>${title}</title>` +
    `<!--[if gte mso 9]><xml><w:WordDocument>` +
    `<w:View>Print</w:View><w:Zoom>100</w:Zoom>` +
    `<w:BiDi/></w:WordDocument></xml><![endif]-->` +
    `<style>${WORD_STYLES}</style></head>` +
    `<body dir='rtl'><h1>${title}</h1>${bodyHtml}</body></html>`
  );
}

export function exportHighlightsDocs(highlights: ExportHighlight[]) {
  const body = highlights
    .map((h, i) => {
      const cit = citation(h.bookTitleAr, h.chapterTitleAr, h.chapterOrder, h.createdAt);
      return (
        `<div class="entry">` +
        `<div class="text">${h.selectedText}</div>` +
        `<div class="citation">${cit}</div>` +
        `</div>` +
        (i < highlights.length - 1 ? "<hr>" : "")
      );
    })
    .join("\n");
  downloadBlob(
    wordDocument("تظليلاتي — ابن قيم الجوزية", body),
    "تظليلاتي.doc",
    "application/msword"
  );
}

export function exportNotesDocs(notes: ExportNote[]) {
  const body = notes
    .map((n, i) => {
      const cit = citation(n.bookTitleAr, n.chapterTitleAr, n.chapterOrder, n.createdAt);
      const quoted = n.selectedText
        ? `<div class="quoted">${n.selectedText}</div>`
        : "";
      return (
        `<div class="entry">` +
        `${quoted}` +
        `<div class="note-label">ملاحظتي:</div>` +
        `<div class="text">${n.content}</div>` +
        `<div class="citation">${cit}</div>` +
        `</div>` +
        (i < notes.length - 1 ? "<hr>" : "")
      );
    })
    .join("\n");
  downloadBlob(
    wordDocument("ملاحظاتي — ابن قيم الجوزية", body),
    "ملاحظاتي.doc",
    "application/msword"
  );
}

// ── PDF (jsPDF + html2canvas, direct download) ─────────────────────────────

const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Traditional Arabic', 'Arial Unicode MS', serif;
    font-size: 14pt;
    direction: rtl;
    text-align: right;
    color: #1a1a1a;
    line-height: 1.9;
    background: #fff;
    width: 794px;
    padding: 60px;
  }
  h1 {
    font-size: 18pt;
    text-align: center;
    color: #5a3e2b;
    border-bottom: 2px solid #c9a96e;
    padding-bottom: 10px;
    margin-bottom: 28px;
  }
  .entry { margin-bottom: 24px; }
  .text { font-size: 14pt; margin-bottom: 8px; line-height: 1.9; }
  .quoted {
    font-style: italic;
    color: #555;
    border-right: 3px solid #bbb;
    padding-right: 10px;
    margin-bottom: 6px;
    font-size: 13pt;
  }
  .note-label { font-size: 10pt; color: #888; margin-bottom: 2px; }
  .citation {
    font-size: 10pt;
    color: #777;
    border-right: 3px solid #c9a96e;
    padding-right: 8px;
    margin-top: 6px;
  }
  .divider {
    border: none;
    border-top: 1px solid #e0d4c4;
    margin: 20px 0;
  }
`;

function buildPdfHtml(title: string, bodyHtml: string) {
  return (
    `<!DOCTYPE html><html dir="rtl" lang="ar">` +
    `<head><meta charset="utf-8"><style>${PDF_STYLES}</style></head>` +
    `<body><h1>${title}</h1>${bodyHtml}</body></html>`
  );
}

async function renderToPDF(title: string, bodyHtml: string, filename: string) {
  // Dynamic import to keep initial bundle lean
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // Build a same-document iframe so fonts & styles are isolated
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: "794px",
    height: "1px",
    border: "none",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(buildPdfHtml(title, bodyHtml));
  doc.close();

  // Wait for layout + any system fonts
  await new Promise<void>((resolve) => {
    const check = () => {
      if (doc.readyState === "complete") resolve();
      else iframe.addEventListener("load", () => resolve(), { once: true });
    };
    check();
  });
  await doc.fonts.ready;

  const body = doc.body;
  const fullHeight = body.scrollHeight;
  iframe.style.height = `${fullHeight}px`;

  // Give browser one frame to paint
  await new Promise((r) => requestAnimationFrame(r));

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: 794,
    height: fullHeight,
    windowWidth: 794,
  });

  document.body.removeChild(iframe);

  const A4_W = 210;
  const A4_H = 297;
  const imgW = A4_W;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.93);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let yOffset = 0;
  while (yOffset < imgH) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -yOffset, imgW, imgH);
    yOffset += A4_H;
  }

  pdf.save(filename);
}

function highlightsPdfBody(highlights: ExportHighlight[]) {
  return highlights
    .map((h, i) => {
      const cit = citation(h.bookTitleAr, h.chapterTitleAr, h.chapterOrder, h.createdAt);
      return (
        `<div class="entry">` +
        `<div class="text">${h.selectedText}</div>` +
        `<div class="citation">${cit}</div>` +
        `</div>` +
        (i < highlights.length - 1 ? `<hr class="divider">` : "")
      );
    })
    .join("\n");
}

function notesPdfBody(notes: ExportNote[]) {
  return notes
    .map((n, i) => {
      const cit = citation(n.bookTitleAr, n.chapterTitleAr, n.chapterOrder, n.createdAt);
      const quoted = n.selectedText
        ? `<div class="quoted">${n.selectedText}</div>`
        : "";
      return (
        `<div class="entry">` +
        `${quoted}` +
        `<div class="note-label">ملاحظتي:</div>` +
        `<div class="text">${n.content}</div>` +
        `<div class="citation">${cit}</div>` +
        `</div>` +
        (i < notes.length - 1 ? `<hr class="divider">` : "")
      );
    })
    .join("\n");
}

export function exportHighlightsPDF(highlights: ExportHighlight[]) {
  return renderToPDF(
    "تظليلاتي — ابن قيم الجوزية",
    highlightsPdfBody(highlights),
    "تظليلاتي.pdf"
  );
}

export function exportNotesPDF(notes: ExportNote[]) {
  return renderToPDF(
    "ملاحظاتي — ابن قيم الجوزية",
    notesPdfBody(notes),
    "ملاحظاتي.pdf"
  );
}
