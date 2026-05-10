"""
Converts tafsir-ibn-al-qayyim.json (keyed by surah:ayah) into the project's
standard extracted-book format so seed-from-extracted.ts can seed it directly.

Output: scripts/output/ibn-qayyim/تفسير-ابن-القيم.json
"""

import json
import re
import os
import sys
from datetime import datetime

SURAH_NAMES = [
    "",  # 0-padding for 1-indexed
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة",
    "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر",
    "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان",
    "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر",
    "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية",
    "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن",
    "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق",
    "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة",
    "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج",
    "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين",
    "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل",
    "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس",
]

ARABIC_NUMS = "٠١٢٣٤٥٦٧٨٩"

def to_arabic_num(n: int) -> str:
    return "".join(ARABIC_NUMS[int(d)] for d in str(n))


def strip_html(html: str) -> str:
    # h3 headings → [فصل: ...]
    html = re.sub(r'<h3[^>]*>\s*\[?(.*?)\]?\s*</h3>', r'\n[\1]\n', html, flags=re.DOTALL | re.IGNORECASE)
    # paragraph breaks
    html = re.sub(r'</p>', '\n\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    # strip all remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    # decode common HTML entities
    html = html.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ')
    # collapse excessive blank lines
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "../../attached_assets/tafsir-extract/tafsir-ibn-al-qayyim.json")
    output_dir = os.path.join(script_dir, "../output/ibn-qayyim")
    output_path = os.path.join(output_dir, "تفسير-ابن-القيم.json")
    index_path = os.path.join(output_dir, "index.json")

    print("قراءة ملف التفسير...")
    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    print(f"إجمالي المداخل: {len(raw)}")

    # Group verses by surah
    surahs: dict[int, list[tuple[int, str]]] = {}
    for key, value in raw.items():
        parts = key.split(":")
        if len(parts) != 2:
            continue
        surah_num = int(parts[0])
        ayah_num = int(parts[1])
        text_html = value.get("text", "") if isinstance(value, dict) else str(value)
        text = strip_html(text_html)
        if surah_num not in surahs:
            surahs[surah_num] = []
        surahs[surah_num].append((ayah_num, text))

    # Sort within each surah
    for surah_num in surahs:
        surahs[surah_num].sort(key=lambda x: x[0])

    print(f"السور التي تحوي تفسيراً: {len(surahs)}")

    # Build index and pages in surah order
    book_index = []
    book_pages = []

    for surah_num in sorted(surahs.keys()):
        surah_name_ar = SURAH_NAMES[surah_num] if surah_num <= 114 else f"سورة {surah_num}"
        chapter_title = f"سورة {surah_name_ar}"

        book_index.append({
            "title": chapter_title,
            "level": 1,
            "page": len(book_pages) + 1,
        })

        parts = []
        for ayah_num, text in surahs[surah_num]:
            ayah_header = f"[الآية {to_arabic_num(ayah_num)}]"
            parts.append(f"{ayah_header}\n{text}")

        content = "\n\n".join(parts)

        book_pages.append({
            "page_num": len(book_pages) + 1,
            "vol": "تفسير القرآن الكريم",
            "headings": [chapter_title],
            "text": content,
        })

    book_data = {
        "id": "تفسير-ابن-القيم",
        "title": "تفسير ابن القيم",
        "author": "ابن قيم الجوزية",
        "source": "مباشر",
        "source_id": 0,
        "volumes_count": 1,
        "volumes": ["تفسير القرآن الكريم"],
        "index": book_index,
        "pages": book_pages,
        "extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(book_data, f, ensure_ascii=False, indent=2)

    print(f"كُتب الملف: {output_path}")

    # Update index.json — add tafsir entry if not already present
    with open(index_path, "r", encoding="utf-8") as f:
        idx = json.load(f)

    existing_ids = {b.get("id") for b in idx.get("books", [])}
    if "تفسير-ابن-القيم" not in existing_ids:
        idx["books"].insert(0, {
            "id": "تفسير-ابن-القيم",
            "title": "تفسير ابن القيم",
            "source_id": 0,
            "pages": len(book_pages),
            "volumes": 1,
            "file": "تفسير-ابن-القيم.json",
        })
        idx["books_count"] = len(idx["books"])
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(idx, f, ensure_ascii=False, indent=2)
        print("✅ أُضيف الكتاب إلى index.json")
    else:
        print("ℹ️  الكتاب موجود بالفعل في index.json")

    print(f"\n✅ تم بنجاح: {len(book_index)} سورة → {sum(len(v) for v in surahs.values())} آية")


if __name__ == "__main__":
    main()
