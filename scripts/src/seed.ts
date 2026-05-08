import { readFileSync } from "fs";
import { createRequire } from "module";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SURAH_NAMES: Record<number, { ar: string; en: string }> = {
  1: { ar: "الفاتحة", en: "Al-Fatihah" },
  2: { ar: "البقرة", en: "Al-Baqarah" },
  3: { ar: "آل عمران", en: "Ali Imran" },
  4: { ar: "النساء", en: "An-Nisa" },
  5: { ar: "المائدة", en: "Al-Maidah" },
  6: { ar: "الأنعام", en: "Al-Anam" },
  7: { ar: "الأعراف", en: "Al-Araf" },
  8: { ar: "الأنفال", en: "Al-Anfal" },
  9: { ar: "التوبة", en: "At-Tawbah" },
  10: { ar: "يونس", en: "Yunus" },
  11: { ar: "هود", en: "Hud" },
  12: { ar: "يوسف", en: "Yusuf" },
  13: { ar: "الرعد", en: "Ar-Rad" },
  14: { ar: "إبراهيم", en: "Ibrahim" },
  15: { ar: "الحجر", en: "Al-Hijr" },
  16: { ar: "النحل", en: "An-Nahl" },
  17: { ar: "الإسراء", en: "Al-Isra" },
  18: { ar: "الكهف", en: "Al-Kahf" },
  19: { ar: "مريم", en: "Maryam" },
  20: { ar: "طه", en: "Taha" },
  21: { ar: "الأنبياء", en: "Al-Anbiya" },
  22: { ar: "الحج", en: "Al-Hajj" },
  23: { ar: "المؤمنون", en: "Al-Muminun" },
  24: { ar: "النور", en: "An-Nur" },
  25: { ar: "الفرقان", en: "Al-Furqan" },
  26: { ar: "الشعراء", en: "Ash-Shuara" },
  27: { ar: "النمل", en: "An-Naml" },
  28: { ar: "القصص", en: "Al-Qasas" },
  29: { ar: "العنكبوت", en: "Al-Ankabut" },
  30: { ar: "الروم", en: "Ar-Rum" },
  31: { ar: "لقمان", en: "Luqman" },
  32: { ar: "السجدة", en: "As-Sajdah" },
  33: { ar: "الأحزاب", en: "Al-Ahzab" },
  34: { ar: "سبأ", en: "Saba" },
  35: { ar: "فاطر", en: "Fatir" },
  36: { ar: "يس", en: "Yaseen" },
  37: { ar: "الصافات", en: "As-Saffat" },
  38: { ar: "ص", en: "Sad" },
  39: { ar: "الزمر", en: "Az-Zumar" },
  40: { ar: "غافر", en: "Ghafir" },
  41: { ar: "فصلت", en: "Fussilat" },
  42: { ar: "الشورى", en: "Ash-Shura" },
  43: { ar: "الزخرف", en: "Az-Zukhruf" },
  44: { ar: "الدخان", en: "Ad-Dukhan" },
  45: { ar: "الجاثية", en: "Al-Jathiyah" },
  46: { ar: "الأحقاف", en: "Al-Ahqaf" },
  47: { ar: "محمد", en: "Muhammad" },
  48: { ar: "الفتح", en: "Al-Fath" },
  49: { ar: "الحجرات", en: "Al-Hujurat" },
  50: { ar: "ق", en: "Qaf" },
  51: { ar: "الذاريات", en: "Adh-Dhariyat" },
  52: { ar: "الطور", en: "At-Tur" },
  53: { ar: "النجم", en: "An-Najm" },
  54: { ar: "القمر", en: "Al-Qamar" },
  55: { ar: "الرحمن", en: "Ar-Rahman" },
  56: { ar: "الواقعة", en: "Al-Waqiah" },
  57: { ar: "الحديد", en: "Al-Hadid" },
  58: { ar: "المجادلة", en: "Al-Mujadila" },
  59: { ar: "الحشر", en: "Al-Hashr" },
  60: { ar: "الممتحنة", en: "Al-Mumtahanah" },
  61: { ar: "الصف", en: "As-Saf" },
  62: { ar: "الجمعة", en: "Al-Jumuah" },
  63: { ar: "المنافقون", en: "Al-Munafiqun" },
  64: { ar: "التغابن", en: "At-Taghabun" },
  65: { ar: "الطلاق", en: "At-Talaq" },
  66: { ar: "التحريم", en: "At-Tahrim" },
  67: { ar: "الملك", en: "Al-Mulk" },
  68: { ar: "القلم", en: "Al-Qalam" },
  69: { ar: "الحاقة", en: "Al-Haqqah" },
  70: { ar: "المعارج", en: "Al-Maarij" },
  71: { ar: "نوح", en: "Nuh" },
  72: { ar: "الجن", en: "Al-Jinn" },
  73: { ar: "المزمل", en: "Al-Muzzammil" },
  74: { ar: "المدثر", en: "Al-Muddathir" },
  75: { ar: "القيامة", en: "Al-Qiyamah" },
  76: { ar: "الإنسان", en: "Al-Insan" },
  77: { ar: "المرسلات", en: "Al-Mursalat" },
  78: { ar: "النبأ", en: "An-Naba" },
  79: { ar: "النازعات", en: "An-Naziat" },
  80: { ar: "عبس", en: "Abasa" },
  81: { ar: "التكوير", en: "At-Takwir" },
  82: { ar: "الانفطار", en: "Al-Infitar" },
  83: { ar: "المطففين", en: "Al-Mutaffifin" },
  84: { ar: "الانشقاق", en: "Al-Inshiqaq" },
  85: { ar: "البروج", en: "Al-Buruj" },
  86: { ar: "الطارق", en: "At-Tariq" },
  87: { ar: "الأعلى", en: "Al-Ala" },
  88: { ar: "الغاشية", en: "Al-Ghashiyah" },
  89: { ar: "الفجر", en: "Al-Fajr" },
  90: { ar: "البلد", en: "Al-Balad" },
  91: { ar: "الشمس", en: "Ash-Shams" },
  92: { ar: "الليل", en: "Al-Layl" },
  93: { ar: "الضحى", en: "Ad-Duha" },
  94: { ar: "الشرح", en: "Ash-Sharh" },
  95: { ar: "التين", en: "At-Tin" },
  96: { ar: "العلق", en: "Al-Alaq" },
  97: { ar: "القدر", en: "Al-Qadr" },
  98: { ar: "البينة", en: "Al-Bayyinah" },
  99: { ar: "الزلزلة", en: "Az-Zalzalah" },
  100: { ar: "العاديات", en: "Al-Adiyat" },
  101: { ar: "القارعة", en: "Al-Qariah" },
  102: { ar: "التكاثر", en: "At-Takathur" },
  103: { ar: "العصر", en: "Al-Asr" },
  104: { ar: "الهمزة", en: "Al-Humazah" },
  105: { ar: "الفيل", en: "Al-Fil" },
  106: { ar: "قريش", en: "Quraysh" },
  107: { ar: "الماعون", en: "Al-Maun" },
  108: { ar: "الكوثر", en: "Al-Kawthar" },
  109: { ar: "الكافرون", en: "Al-Kafirun" },
  110: { ar: "النصر", en: "An-Nasr" },
  111: { ar: "المسد", en: "Al-Masad" },
  112: { ar: "الإخلاص", en: "Al-Ikhlas" },
  113: { ar: "الفلق", en: "Al-Falaq" },
  114: { ar: "الناس", en: "An-Nas" },
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function seed() {
  const client = await pool.connect();
  try {
    const zipPath = path.join(
      __dirname,
      "../../attached_assets/tafsir-ibn-al-qayyim.json_1778257354964.zip",
    );

    console.log("Reading tafsir data from ZIP...");

    let tafsirData: Record<string, { text: string }>;
    try {
      const { createReadStream } = await import("fs");
      const AdmZip = (await import("adm-zip" as any)).default;
      const zip = new AdmZip(zipPath);
      const entry = zip.getEntries()[0];
      const content = entry.getData().toString("utf8");
      tafsirData = JSON.parse(content);
    } catch {
      console.log("adm-zip not available, trying direct file read...");
      const { execSync } = await import("child_process");
      const content = execSync(
        `python3 -c "import zipfile,json,sys; zf=zipfile.ZipFile('${zipPath}'); content=zf.open(zf.namelist()[0]).read(); sys.stdout.buffer.write(content)"`,
      );
      tafsirData = JSON.parse(content.toString("utf8"));
    }

    console.log(`Loaded ${Object.keys(tafsirData).length} tafsir entries`);

    const surahMap = new Map<number, string[]>();
    for (const [key, val] of Object.entries(tafsirData)) {
      const surahNum = parseInt(key.split(":")[0]);
      if (!surahMap.has(surahNum)) surahMap.set(surahNum, []);
      surahMap.get(surahNum)!.push(stripHtml(val.text));
    }

    console.log(`Grouped into ${surahMap.size} surahs`);

    await client.query("BEGIN");

    const existingBooks = await client.query(
      "SELECT id FROM books WHERE title = $1 LIMIT 1",
      ["Bada'i Al-Tafsir"],
    );

    let bookId: number;

    if (existingBooks.rows.length > 0) {
      bookId = existingBooks.rows[0].id;
      console.log(`Book already exists with id ${bookId}, updating chapters...`);
      await client.query("DELETE FROM chapters WHERE book_id = $1", [bookId]);
    } else {
      const bookRes = await client.query(
        `INSERT INTO books (title, title_ar, description, category, cover_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          "Bada'i Al-Tafsir",
          "بدائع التفسير",
          "تفسير ابن القيم الجوزية رحمه الله للقرآن الكريم، جمع فيه أجود ما وقع له من التفسير في سائر كتبه ورسائله، وهو من أنفس كتب التفسير وأجمعها.",
          "التفسير",
          "#1a5276",
        ],
      );
      bookId = bookRes.rows[0].id;
      console.log(`Inserted book with id ${bookId}`);
    }

    const sortedSurahs = Array.from(surahMap.entries()).sort(
      ([a], [b]) => a - b,
    );

    let inserted = 0;
    for (const [surahNum, texts] of sortedSurahs) {
      const name = SURAH_NAMES[surahNum];
      if (!name) continue;

      const titleAr = `سورة ${name.ar} — التفسير`;
      const titleEn = `Surah ${name.en} — Commentary`;
      const content = texts.join("\n\n");

      await client.query(
        `INSERT INTO chapters (book_id, title, title_ar, content, order_index)
         VALUES ($1, $2, $3, $4, $5)`,
        [bookId, titleEn, titleAr, content, surahNum],
      );
      inserted++;
    }

    console.log(`Inserted ${inserted} chapters`);
    await client.query("COMMIT");
    console.log("Seed complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
