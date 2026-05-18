import { useLanguage, type LanguageCode } from "@/lib/i18n";

const EN_TRANSLATIONS: Record<string, string> = {
  "تجاوز إلى المحتوى": "Skip to content",
  "موروث ابن القيم": "Ibn al-Qayyim Legacy",
  "تراث ابن القيم": "Ibn al-Qayyim Legacy",
  المكتبة: "Library",
  "ترتيب القراءة": "Reading Plan",
  الخطة: "Plan",
  البحث: "Search",
  المحفوظات: "Saved",
  الملاحظات: "Notes",
  الدعم: "Support",
  "طريقة استخدام الموقع": "How to use the site",
  "تبديل المظهر": "Toggle theme",
  "التنقل السفلي": "Bottom navigation",
  "تثبيت التطبيق": "Install app",
  "حمّل الموقع للقراءة لاحقاً": "Install the site for later reading",
  "بعد أن جرّبت المكتبة، يمكنك تحميل الموقع ليبقى قريباً ويعمل بسرعة من جهازك.":
    "Now that you have tried the library, install the site so it stays close and opens quickly from your device.",
  "بعد أن قرأت لبعض الوقت، يمكنك تحميل الموقع ليبقى قريباً ويعمل بسرعة من جهازك.":
    "After reading for a while, install the site so it stays close and opens quickly from your device.",
  "تحميل الموقع": "Install site",
  "جاري فتح نافذة التحميل": "Opening install prompt...",
  "ليس الآن": "Not now",
  "إغلاق طلب التحميل": "Close install prompt",
  اللغة: "Language",
  "تغيير اللغة، اللغة الحالية: {language}":
    "Change language, current: {language}",
  العربية: "Arabic",
  الألمانية: "German",
  الإنجليزية: "English",
  "نسبة القراءة": "Reading progress",
  "ابحث في الكتب والفصول": "Search books and sections",
  "ابحث في المكتبة": "Search the library",
  "ابحث باسم الكتاب": "Search by book title",
  بحث: "Search",
  "تابع القراءة": "Continue Reading",
  "عرض الكل": "View all",
  "ابدأ من المكتبة": "Start from the library",
  "اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.":
    "Choose a book and start reading. Your place will be saved locally in this browser.",
  "كتب ابن القيم المتاحة للقراءة من البيانات المحلية.":
    "Ibn al-Qayyim's books available to read from local data.",
  "عرض جميع الكتب": "View all books",
  "تعذر تحميل المكتبة": "Could not load the library",
  "الإمام ابن قيم الجوزية": "Imam Ibn Qayyim al-Jawziyyah",
  "الإمام ابن القيم الجوزية": "Imam Ibn Qayyim al-Jawziyyah",
  "ابدأ القراءة من أول فصل": "Start reading from the first section",
  "مواصلة القراءة": "Continue reading",
  "حدث خطأ": "Something went wrong",
  "تعذر تحميل البيانات.": "Could not load the data.",
  "إعادة المحاولة": "Try again",
  "جار التحميل": "Loading",
  "جار تحميل الكتب": "Loading books",
  "جار تحميل الطبعات": "Loading editions",
  "جار البحث": "Searching",
  "طبعة واحدة": "1 edition",
  طبعتان: "2 editions",
  "فتح الكتاب": "Open book",
  "فتح الطبعة": "Open edition",
  "طبعة متاحة": "Available edition",
  بطاقات: "Cards",
  قائمة: "List",
  "مسح البحث": "Clear search",
  "لا توجد نتائج": "No results",
  "لا توجد كتب لهذه اللغة": "No books in this language",
  "اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها.":
    "Choose another language from the menu to view its available books.",
  "جرب كلمة أقصر أو ابحث باسم آخر للكتاب.":
    "Try a shorter word or search for another book title.",
  "جرب عبارة أقصر أو وسّع نطاق البحث.":
    "Try a shorter phrase or widen the search scope.",
  "لا توجد نتائج بعد الفلترة": "No results after filtering",
  "غيّر نطاق البحث أو موضع المطابقة.":
    "Change the search scope or match location.",
  "تعذر تحميل العمل": "Could not load the work",
  "الطبعات المتاحة": "Available editions",
  "تعذر تحميل الطبعة": "Could not load the edition",
  "ابدأ القراءة": "Start reading",
  "البحث داخل الكتاب": "Search inside the book",
  "اقتراح تصحيح": "Suggest a correction",
  "إبلاغ عن خطأ في الترجمة": "Report a translation issue",
  "تعديل ملف الترجمة على GitHub": "Edit translation file on GitHub",
  "محتويات الطبعة": "Edition contents",
  "النص الكامل": "Full text",
  "مقدمة الكتاب": "Book introduction",
  "العودة إلى المكتبة": "Back to library",
  "العودة إلى الكتاب": "Back to book",
  "الصعود للأعلى": "Back to top",
  "افتح الطبعة التي تريد القراءة منها.":
    "Open the edition you want to read from.",
  "لم يعثر على هذا الكتاب": "This book was not found",
  "قد تكون الطبعة مدرجة بعنوان مختلف. يمكنك العودة إلى المكتبة والبحث باسم الكتاب.":
    "The edition may be listed under a different title. Return to the library and search by book title.",
  "تعذر تحميل الفصل": "Could not load the section",
  المحتويات: "Contents",
  "حفظ موضع القراءة": "Save reading position",
  "نسخ الفصل": "Copy section",
  "البحث داخل هذا القسم": "Search in this section",
  "لا يوجد نص متاح لهذا الفصل بعد.":
    "No text is available for this section yet.",
  "الفصل السابق": "Previous section",
  "الفصل التالي": "Next section",
  "تم النسخ": "Copied",
  "تم حذف التظليل": "Highlight deleted",
  "تم حفظ التظليل": "Highlight saved",
  "تم حفظ الملاحظة": "Note saved",
  "تم حفظ الموضع": "Position saved",
  إغلاق: "Close",
  "ملاحظة اختيارية": "Optional note",
  "لون التظليل": "Highlight color",
  تظليل: "Highlight",
  "حذف التظليل": "Delete highlight",
  "حفظ ملاحظة": "Save note",
  نسخ: "Copy",
  مشاركة: "Share",
  مثال: "Example",
  "إظهار الشريط": "Show toolbar",
  "حجم الخط": "Font size",
  "تصغير الخط": "Decrease font size",
  "تكبير الخط": "Increase font size",
  "نوع الخط": "Font",
  "إخفاء التشكيل": "Hide diacritics",
  "إظهار التشكيل": "Show diacritics",
  "إخفاء الحواشي": "Hide footnotes",
  "إظهار الحواشي": "Show footnotes",
  "إخفاء الشريط": "Hide toolbar",
  "حواشي الصفحة": "Page footnotes",
  "الانتقال إلى الحاشية {marker}": "Go to footnote {marker}",
  الكتاب: "Book",
  ص: "p.",
  باب: "Chapter",
  فصل: "Section",
  عنوان: "Heading",
  موضوع: "Topic",
  "كل المواضع": "All matches",
  العناوين: "Titles",
  النصوص: "Texts",
  "الأقرب صلة": "Most relevant",
  "حسب الكتاب": "By book",
  "حسب الصفحة": "By page",
  "كل المكتبة": "Whole library",
  "داخل كتاب": "Within a book",
  "داخل قسم": "Within a section",
  "ابحث في كل كتب ابن القيم.": "Search all Ibn al-Qayyim books.",
  "احصر البحث في كتاب/طبعة واحدة.": "Limit search to one book or edition.",
  "احصر البحث في قسم أو فصل محدد.": "Limit search to a specific section.",
  "ابحث داخل كل المكتبة، أو احصر البحث في كتاب أو قسم محدد.":
    "Search the whole library, or narrow it to a specific book or section.",
  "مثال: الصبر": "Example: patience",
  "خيارات البحث": "Search options",
  "نطاق البحث": "Search scope",
  "اختر كتاباً": "Choose a book",
  القسم: "Section",
  "اختر قسماً": "Choose a section",
  "موضع المطابقة": "Match location",
  "ترتيب النتائج": "Sort results",
  "تطبيق الخيارات والبحث": "Apply options and search",
  "ابدأ بكتابة عبارة": "Start by typing a phrase",
  "سيظهر لك موضع العبارة في الكتب والفصول مع مقتطف مختصر.":
    "You will see where the phrase appears in books and sections with a short excerpt.",
  مكتبتي: "My Library",
  "مواضع القراءة والتظليلات والملاحظات محفوظة محليا في هذا المتصفح.":
    "Reading positions, highlights, and notes are saved locally in this browser.",
  "لا يوجد سجل قراءة بعد": "No reading history yet",
  "ابدأ قراءة فصل وسيظهر هنا آخر موضع وصلت إليه.":
    "Start reading a section and your latest position will appear here.",
  التظليلات: "Highlights",
  "حدد نصا في القارئ واحفظه كتظليل.":
    "Select text in the reader and save it as a highlight.",
  "لا توجد تظليلات": "No highlights",
  "حدد نصا في القارئ وأضف ملاحظة محلية.":
    "Select text in the reader and add a local note.",
  "لا توجد ملاحظات": "No notes",
  "تحميل المحفوظات": "Download saved items",
  "افتح التفضيلات لاختيار ما تريد تحميله وطريقة ترتيب الملف.":
    "Open preferences to choose what to download and how the file should be ordered.",
  "تحميل كل التظليلات": "Download all highlights",
  "تحميل كل الملاحظات": "Download all notes",
  "كل الكتب": "all books",
  التاريخ: "Date",
  "النص المحدد": "Selected text",
  الملاحظة: "Note",
  "لا توجد تظليلات.": "No highlights.",
  "لا توجد ملاحظات.": "No notes.",
  "تظليلات {label}": "Highlights {label}",
  "ملاحظات {label}": "Notes {label}",
  "لا توجد محفوظات للتحميل": "No saved items to download",
  "عندما تضيف تظليلاً أو ملاحظة سيظهر هنا خيار تحميلها حسب الكتاب.":
    "When you add a highlight or note, download options by book will appear here.",
  "تحميل تظليلات الكتاب": "Download book highlights",
  "تحميل ملاحظات الكتاب": "Download book notes",
  "تفضيلات تحميل الكتاب": "Book download preferences",
  "تفضيلات التحميل": "Download preferences",
  "كيفية التحميل": "Download options",
  "تفاصيل الملف": "File details",
  "إضافة اسم الكتاب": "Include book title",
  "إضافة اسم الفصل": "Include section title",
  "ترتيب الملف": "File order",
  "الأحدث أولاً": "Newest first",
  "الأقدم أولاً": "Oldest first",
  "حسب الكتاب والفصل": "By book and section",
  "حذف المقروءة": "Delete reading position",
  حذف: "Delete",
  "مشاركة الاقتباس": "Share quote",
  "شكل البطاقة": "Card style",
  "المقاس والمصدر": "Size and source",
  "المقاس والتفاصيل": "Size and details",
  "إظهار المصدر": "Show source",
  "إظهار الموقع": "Show site",
  "اسم الموقع": "Site name",
  "موقع الاقتباس": "Quote site",
  "ألوان البطاقة": "Card colors",
  التأكيد: "Accent",
  الخلفية: "Background",
  "تحميل الصورة": "Download image",
  "جاري المشاركة...": "Sharing...",
  "مشاركة مباشرة": "Share directly",
  "مشاركة الآن": "Share now",
  "نسخ نص المشاركة": "Copy share text",
  "وجهات المشاركة": "Share destinations",
  "نص المشاركة": "Share text",
  "استعادة النص الأصلي": "Restore original text",
  "تم نسخ الصورة": "Image copied",
  "نسخ الصورة": "Copy image",
  واتساب: "WhatsApp",
  تليجرام: "Telegram",
  "تم نسخ الرابط": "Link copied",
  "نسخ الرابط": "Copy link",
  "إرفاق رابط القراءة": "Include reading link",
  "تم نسخ النص": "Text copied",
  "نسخ النص": "Copy text",
  "بطاقة الاقتباس": "Quote card",
  "اقتباس من {bookTitle}": "Quote from {bookTitle}",
  "ابن القيم الجوزية رحمه الله":
    "Ibn Qayyim al-Jawziyyah, may Allah have mercy on him",
  "تعذرت المشاركة المباشرة. يمكنك نسخ النص أو تحميل الصورة.":
    "Direct sharing failed. You can copy the text or download the image.",
  "المشاركة المباشرة غير مدعومة في هذا المتصفح. استخدم واتساب أو تليجرام أو نسخ النص.":
    "Direct sharing is not supported in this browser. Use WhatsApp, Telegram, or copy the text.",
  "تعذر فتح نافذة المشاركة. استخدم المشاركة المباشرة أو انسخ النص.":
    "Could not open the share window. Use direct sharing or copy the text.",
  "تعذر نسخ الصورة. يمكنك تحميلها بدلا من ذلك.":
    "Could not copy the image. Download it instead.",
  "اختيار لون {label}": "Choose {label} color",
  "لون {color}": "Color {color}",
  "فإن في القلب شعثا لا يلمه إلا الإقبال على الله":
    "There is a disarray in the heart that only turning to Allah can gather.",
  مخطوط: "Manuscript",
  "ورق هادئ وحدود هندسية للنصوص الطويلة":
    "Quiet paper and geometric borders for longer texts",
  محراب: "Mihrab",
  "خلفية داكنة وعمق بصري مناسب للمشاركة":
    "A dark background with visual depth for sharing",
  "غلاف الكتاب": "Book cover",
  "يربط البطاقة بلون الكتاب ومصدر الاقتباس":
    "Connects the card to the book color and quote source",
  مربع: "Square",
  قصة: "Story",
  ذهبي: "Gold",
  أخضر: "Green",
  أزرق: "Blue",
  وردي: "Pink",
  "أهلا بك في موروث ابن القيم": "Welcome to Ibn al-Qayyim Legacy",
  "هذه جولة سريعة توضح كيف تبحث، تفتح كتابا، تنسخ النصوص، وتشارك اقتباسا منسقا كصورة قابلة للتعديل.":
    "This quick tour shows how to search, open a book, copy text, and share a formatted quote as an editable image.",
  "ابدأ بالبحث": "Start with search",
  "اكتب كلمة أو عبارة هنا للبحث في الكتب والفصول، ثم اضغط زر البحث للانتقال إلى النتائج.":
    "Type a word or phrase here to search books and sections, then press Search to open the results.",
  "افتح المكتبة": "Open the library",
  "من المكتبة يمكنك تصفح الأعمال المتاحة. اضغط أي بطاقة عمل للوصول إلى الطبعات ثم اختر الطبعة المناسبة.":
    "From the library you can browse available works. Choose a work card to view editions, then open the right edition.",
  "في صفحة الطبعة يظهر زر بدء القراءة. الجولة تستخدم أول طبعة متاحة كمثال حتى ترى المسار كاملا.":
    "On the edition page, the Start reading button appears. The tour uses the first available edition as an example so you can see the whole path.",
  "في صفحة طبعة الداء والدواء من عطاءات العلم يظهر زر بدء القراءة، ومنها تكمل الجولة داخل القارئ.":
    "On the Ataat al-Ilm edition page for Al-Daa wa al-Dawa, the Start reading button appears, then the tour continues in the reader.",
  "اقرأ الفصل": "Read the section",
  "هذا هو سطح القراءة. مرر بين الصفحات، وسيحفظ الموقع موضعك محليا في هذا المتصفح.":
    "This is the reader. Scroll through pages and the site will save your place locally in this browser.",
  "اضبط تجربة القراءة": "Adjust the reading experience",
  "من هذا الشريط تفتح المحتويات، تكبر أو تصغر الخط، تغير نوع الخط، وتظهر أو تخفي التشكيل.":
    "Use this toolbar to open contents, change font size and type, and show or hide diacritics.",
  "انسخ نصا جاهزا للصق": "Copy text ready to paste",
  "زر النسخ في أعلى القارئ ينسخ نص الفصل مع نسبة المصدر. بعد النسخ يمكنك لصقه في ملاحظاتك، بريدك، أو أي محرر نصوص.":
    "The copy button at the top of the reader copies the section text with its source. You can paste it into notes, email, or any text editor.",
  "النص المنسوخ يتضمن الكتاب والفصل.":
    "The copied text includes the book and section.",
  "استخدمه عندما تريد حفظ الفصل أو جزء كبير منه خارج الموقع.":
    "Use it when you want to save a section or a larger excerpt outside the site.",
  "حدد جزءا من النص": "Select part of the text",
  "ظلّل عبارة داخل الصفحة كما تفعل في أي قارئ. عند ترك التحديد يظهر شريط أعمال سريع في أسفل الشاشة.":
    "Select a phrase on the page as you would in any reader. When you release the selection, a quick action bar appears at the bottom.",
  "يمكنك تظليل العبارة، حفظ ملاحظة، نسخها، أو تحويلها إلى بطاقة مشاركة.":
    "You can highlight the phrase, save a note, copy it, or turn it into a share card.",
  "اختر ما تريد فعله بالاقتباس": "Choose what to do with the quote",
  "هذا مثال للشريط الذي يظهر بعد تحديد النص. زر النسخ يعطيك نصا منسقا للصق، وزر المشاركة يفتح بطاقة اقتباس جاهزة.":
    "This is an example of the bar that appears after text selection. Copy gives you formatted text to paste, and Share opens a ready quote card.",
  "شارك جزءا منسقا": "Share a formatted excerpt",
  "عند الضغط على مشاركة، يولد الموقع بطاقة اقتباس بالصورة والمعنى: النص في الوسط، والمصدر محفوظ أسفل البطاقة.":
    "When you press Share, the site generates a quote card: the text is centered, and the source is preserved at the bottom.",
  "عدّل صورة الاقتباس": "Edit the quote image",
  "من هذه اللوحة تستطيع اختيار قالب البطاقة، مقاس مربع أو قصة، إظهار المصدر، وتغيير ألوان التأكيد والخلفية قبل التصدير.":
    "From this panel, you can choose the card template, square or story size, show the source, and adjust accent and background colors before export.",
  "صدّر أو شارك": "Export or share",
  "بعد ضبط الصورة حمّلها، انسخ النص، أو استخدم المشاركة المباشرة عندما يدعمها المتصفح. هكذا يصبح الاقتباس جاهزا للنشر أو الحفظ.":
    "After adjusting the image, download it, copy the text, or use direct sharing when the browser supports it. The quote is then ready to publish or save.",
  "لم يظهر هذا الموضع بعد. يمكنك المتابعة، وستنتقل الجولة إلى الخطوة التالية.":
    "This target has not appeared yet. You can continue and the tour will move to the next step.",
  "خطوة {current} من {total}": "Step {current} of {total}",
  السابق: "Previous",
  إنهاء: "Finish",
  "ابدأ الجولة": "Start tour",
  التالي: "Next",
  تخطي: "Skip",
  "الصفحة غير موجودة": "Page not found",
  "يبدو أن هذه الصفحة لا وجود لها أو أن الرابط خاطئ.":
    "This page does not exist, or the link is incorrect.",
  "العودة إلى الرئيسية": "Back to home",
};

const DE_TRANSLATIONS: Record<string, string> = {
  "تجاوز إلى المحتوى": "Zum Inhalt springen",
  "موروث ابن القيم": "Ibn al-Qayyim Vermächtnis",
  "تراث ابن القيم": "Ibn al-Qayyim Vermächtnis",
  المكتبة: "Bibliothek",
  "ترتيب القراءة": "Leseplan",
  الخطة: "Plan",
  البحث: "Suche",
  المحفوظات: "Gespeichert",
  الملاحظات: "Notizen",
  الدعم: "Unterstützen",
  "طريقة استخدام الموقع": "Website-Hilfe",
  "تبديل المظهر": "Darstellung wechseln",
  "التنقل السفلي": "Untere Navigation",
  "تثبيت التطبيق": "App installieren",
  "حمّل الموقع للقراءة لاحقاً": "Website zum späteren Lesen installieren",
  "بعد أن جرّبت المكتبة، يمكنك تحميل الموقع ليبقى قريباً ويعمل بسرعة من جهازك.":
    "Nachdem du die Bibliothek ausprobiert hast, kannst du die Website installieren, damit sie schnell auf deinem Gerät erreichbar bleibt.",
  "بعد أن قرأت لبعض الوقت، يمكنك تحميل الموقع ليبقى قريباً ويعمل بسرعة من جهازك.":
    "Nachdem du eine Weile gelesen hast, kannst du die Website installieren, damit sie schnell auf deinem Gerät erreichbar bleibt.",
  "تحميل الموقع": "Website installieren",
  "جاري فتح نافذة التحميل": "Installationsdialog wird geöffnet...",
  "ليس الآن": "Nicht jetzt",
  "إغلاق طلب التحميل": "Installationshinweis schließen",
  اللغة: "Sprache",
  "تغيير اللغة، اللغة الحالية: {language}":
    "Sprache ändern, aktuell: {language}",
  العربية: "Arabisch",
  الألمانية: "Deutsch",
  الإنجليزية: "Englisch",
  "نسبة القراءة": "Lesefortschritt",
  "ابحث في الكتب والفصول": "Bücher und Abschnitte durchsuchen",
  "ابحث في المكتبة": "Bibliothek durchsuchen",
  "ابحث باسم الكتاب": "Nach Buchtitel suchen",
  بحث: "Suchen",
  "تابع القراءة": "Weiterlesen",
  "عرض الكل": "Alle anzeigen",
  "ابدأ من المكتبة": "In der Bibliothek beginnen",
  "اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.":
    "Wähle ein Buch und beginne zu lesen. Deine Position wird lokal in diesem Browser gespeichert.",
  "كتب ابن القيم المتاحة للقراءة من البيانات المحلية.":
    "Die aus den lokalen Daten verfügbaren Werke Ibn al-Qayyims.",
  "عرض جميع الكتب": "Alle Bücher anzeigen",
  "تعذر تحميل المكتبة": "Bibliothek konnte nicht geladen werden",
  "الإمام ابن قيم الجوزية": "Imam Ibn Qayyim al-Dschauziyya",
  "الإمام ابن القيم الجوزية": "Imam Ibn Qayyim al-Dschauziyya",
  "ابدأ القراءة من أول فصل": "Mit dem ersten Abschnitt beginnen",
  "مواصلة القراءة": "Weiterlesen",
  "حدث خطأ": "Etwas ist schiefgelaufen",
  "تعذر تحميل البيانات.": "Die Daten konnten nicht geladen werden.",
  "إعادة المحاولة": "Erneut versuchen",
  "جار التحميل": "Wird geladen",
  "جار تحميل الكتب": "Bücher werden geladen",
  "جار تحميل الطبعات": "Ausgaben werden geladen",
  "جار البحث": "Suche läuft",
  "طبعة واحدة": "1 Ausgabe",
  طبعتان: "2 Ausgaben",
  "فتح الكتاب": "Buch öffnen",
  "فتح الطبعة": "Ausgabe öffnen",
  "طبعة متاحة": "Verfügbare Ausgabe",
  بطاقات: "Karten",
  قائمة: "Liste",
  "مسح البحث": "Suche löschen",
  "لا توجد نتائج": "Keine Ergebnisse",
  "لا توجد كتب لهذه اللغة": "Keine Bücher in dieser Sprache",
  "اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها.":
    "Wähle eine andere Sprache, um verfügbare Bücher anzuzeigen.",
  "جرب كلمة أقصر أو ابحث باسم آخر للكتاب.":
    "Versuche ein kürzeres Wort oder einen anderen Buchtitel.",
  "جرب عبارة أقصر أو وسّع نطاق البحث.":
    "Versuche eine kürzere Formulierung oder erweitere den Suchbereich.",
  "لا توجد نتائج بعد الفلترة": "Keine Ergebnisse nach dem Filtern",
  "غيّر نطاق البحث أو موضع المطابقة.":
    "Ändere Suchbereich oder Trefferposition.",
  "تعذر تحميل العمل": "Werk konnte nicht geladen werden",
  "الطبعات المتاحة": "Verfügbare Ausgaben",
  "تعذر تحميل الطبعة": "Ausgabe konnte nicht geladen werden",
  "ابدأ القراءة": "Lesen beginnen",
  "البحث داخل الكتاب": "Im Buch suchen",
  "اقتراح تصحيح": "Korrektur vorschlagen",
  "إبلاغ عن خطأ في الترجمة": "Übersetzungsfehler melden",
  "تعديل ملف الترجمة على GitHub": "Übersetzungsdatei auf GitHub bearbeiten",
  "محتويات الطبعة": "Inhalt der Ausgabe",
  "النص الكامل": "Volltext",
  "مقدمة الكتاب": "Einleitung",
  "العودة إلى المكتبة": "Zurück zur Bibliothek",
  "العودة إلى الكتاب": "Zurück zum Buch",
  "الصعود للأعلى": "Nach oben",
  "افتح الطبعة التي تريد القراءة منها.":
    "Öffne die Ausgabe, aus der du lesen möchtest.",
  "لم يعثر على هذا الكتاب": "Dieses Buch wurde nicht gefunden",
  "قد تكون الطبعة مدرجة بعنوان مختلف. يمكنك العودة إلى المكتبة والبحث باسم الكتاب.":
    "Die Ausgabe kann unter einem anderen Titel geführt sein. Kehre zur Bibliothek zurück und suche nach dem Buchtitel.",
  "تعذر تحميل الفصل": "Abschnitt konnte nicht geladen werden",
  المحتويات: "Inhalt",
  "حفظ موضع القراءة": "Leseposition speichern",
  "نسخ الفصل": "Abschnitt kopieren",
  "البحث داخل هذا القسم": "In diesem Abschnitt suchen",
  "لا يوجد نص متاح لهذا الفصل بعد.":
    "Für diesen Abschnitt ist noch kein Text verfügbar.",
  "الفصل السابق": "Vorheriger Abschnitt",
  "الفصل التالي": "Nächster Abschnitt",
  "تم النسخ": "Kopiert",
  "تم حذف التظليل": "Markierung gelöscht",
  "تم حفظ التظليل": "Markierung gespeichert",
  "تم حفظ الملاحظة": "Notiz gespeichert",
  "تم حفظ الموضع": "Position gespeichert",
  إغلاق: "Schließen",
  "ملاحظة اختيارية": "Optionale Notiz",
  "لون التظليل": "Markierungsfarbe",
  تظليل: "Markieren",
  "حذف التظليل": "Markierung löschen",
  "حفظ ملاحظة": "Notiz speichern",
  نسخ: "Kopieren",
  مشاركة: "Teilen",
  مثال: "Beispiel",
  "إظهار الشريط": "Leiste anzeigen",
  "حجم الخط": "Schriftgröße",
  "تصغير الخط": "Schrift verkleinern",
  "تكبير الخط": "Schrift vergrößern",
  "نوع الخط": "Schriftart",
  "إخفاء التشكيل": "Vokalzeichen ausblenden",
  "إظهار التشكيل": "Vokalzeichen anzeigen",
  "إخفاء الحواشي": "Fußnoten ausblenden",
  "إظهار الحواشي": "Fußnoten anzeigen",
  "إخفاء الشريط": "Leiste ausblenden",
  "حواشي الصفحة": "Seitenfußnoten",
  "الانتقال إلى الحاشية {marker}": "Zur Fußnote {marker}",
  الكتاب: "Buch",
  ص: "S.",
  باب: "Kapitel",
  فصل: "Abschnitt",
  عنوان: "Überschrift",
  موضوع: "Thema",
  "كل المواضع": "Alle Treffer",
  العناوين: "Titel",
  النصوص: "Texte",
  "الأقرب صلة": "Relevanteste",
  "حسب الكتاب": "Nach Buch",
  "حسب الصفحة": "Nach Seite",
  "كل المكتبة": "Ganze Bibliothek",
  "داخل كتاب": "In einem Buch",
  "داخل قسم": "In einem Abschnitt",
  "ابحث في كل كتب ابن القيم.": "Durchsuche alle Bücher Ibn al-Qayyims.",
  "احصر البحث في كتاب/طبعة واحدة.":
    "Beschränke die Suche auf ein Buch oder eine Ausgabe.",
  "احصر البحث في قسم أو فصل محدد.":
    "Beschränke die Suche auf einen bestimmten Abschnitt.",
  "ابحث داخل كل المكتبة، أو احصر البحث في كتاب أو قسم محدد.":
    "Durchsuche die ganze Bibliothek oder grenze die Suche auf ein Buch oder einen Abschnitt ein.",
  "مثال: الصبر": "Beispiel: Geduld",
  "خيارات البحث": "Suchoptionen",
  "نطاق البحث": "Suchbereich",
  "اختر كتاباً": "Buch wählen",
  القسم: "Abschnitt",
  "اختر قسماً": "Abschnitt wählen",
  "موضع المطابقة": "Trefferposition",
  "ترتيب النتائج": "Ergebnisse sortieren",
  "تطبيق الخيارات والبحث": "Optionen anwenden und suchen",
  "ابدأ بكتابة عبارة": "Beginne mit einer Suchphrase",
  "سيظهر لك موضع العبارة في الكتب والفصول مع مقتطف مختصر.":
    "Du siehst, wo die Phrase in Büchern und Abschnitten vorkommt, mit einem kurzen Auszug.",
  مكتبتي: "Meine Bibliothek",
  "مواضع القراءة والتظليلات والملاحظات محفوظة محليا في هذا المتصفح.":
    "Lesepositionen, Markierungen und Notizen werden lokal in diesem Browser gespeichert.",
  "لا يوجد سجل قراءة بعد": "Noch kein Leseverlauf",
  "ابدأ قراءة فصل وسيظهر هنا آخر موضع وصلت إليه.":
    "Lies einen Abschnitt; deine letzte Position erscheint hier.",
  التظليلات: "Markierungen",
  "حدد نصا في القارئ واحفظه كتظليل.":
    "Wähle Text im Reader aus und speichere ihn als Markierung.",
  "لا توجد تظليلات": "Keine Markierungen",
  "حدد نصا في القارئ وأضف ملاحظة محلية.":
    "Wähle Text im Reader aus und füge eine lokale Notiz hinzu.",
  "لا توجد ملاحظات": "Keine Notizen",
  "تحميل المحفوظات": "Gespeicherte Einträge herunterladen",
  "افتح التفضيلات لاختيار ما تريد تحميله وطريقة ترتيب الملف.":
    "Öffne die Einstellungen, um Inhalt und Sortierung der Datei zu wählen.",
  "تحميل كل التظليلات": "Alle Markierungen herunterladen",
  "تحميل كل الملاحظات": "Alle Notizen herunterladen",
  "كل الكتب": "alle Bücher",
  التاريخ: "Datum",
  "النص المحدد": "Ausgewählter Text",
  الملاحظة: "Notiz",
  "لا توجد تظليلات.": "Keine Markierungen.",
  "لا توجد ملاحظات.": "Keine Notizen.",
  "تظليلات {label}": "Markierungen {label}",
  "ملاحظات {label}": "Notizen {label}",
  "لا توجد محفوظات للتحميل": "Keine gespeicherten Einträge zum Herunterladen",
  "عندما تضيف تظليلاً أو ملاحظة سيظهر هنا خيار تحميلها حسب الكتاب.":
    "Wenn du eine Markierung oder Notiz hinzufügst, erscheinen hier Download-Optionen nach Buch.",
  "تحميل تظليلات الكتاب": "Markierungen des Buches herunterladen",
  "تحميل ملاحظات الكتاب": "Notizen des Buches herunterladen",
  "تفضيلات تحميل الكتاب": "Download-Einstellungen für das Buch",
  "تفضيلات التحميل": "Download-Einstellungen",
  "كيفية التحميل": "Download-Optionen",
  "تفاصيل الملف": "Dateidetails",
  "إضافة اسم الكتاب": "Buchtitel einschließen",
  "إضافة اسم الفصل": "Abschnittstitel einschließen",
  "ترتيب الملف": "Dateisortierung",
  "الأحدث أولاً": "Neueste zuerst",
  "الأقدم أولاً": "Älteste zuerst",
  "حسب الكتاب والفصل": "Nach Buch und Abschnitt",
  "حذف المقروءة": "Leseposition löschen",
  حذف: "Löschen",
  "مشاركة الاقتباس": "Zitat teilen",
  "شكل البطاقة": "Kartenstil",
  "المقاس والمصدر": "Format und Quelle",
  "المقاس والتفاصيل": "Format und Details",
  "إظهار المصدر": "Quelle anzeigen",
  "إظهار الموقع": "Website anzeigen",
  "اسم الموقع": "Websitename",
  "موقع الاقتباس": "Zitatquelle",
  "ألوان البطاقة": "Kartenfarben",
  التأكيد: "Akzent",
  الخلفية: "Hintergrund",
  "تحميل الصورة": "Bild herunterladen",
  "جاري المشاركة...": "Teilen läuft...",
  "مشاركة مباشرة": "Direkt teilen",
  "مشاركة الآن": "Jetzt teilen",
  "نسخ نص المشاركة": "Teiltext kopieren",
  "وجهات المشاركة": "Teilen über",
  "نص المشاركة": "Teiltext",
  "استعادة النص الأصلي": "Originaltext wiederherstellen",
  "تم نسخ الصورة": "Bild kopiert",
  "نسخ الصورة": "Bild kopieren",
  واتساب: "WhatsApp",
  تليجرام: "Telegram",
  "تم نسخ الرابط": "Link kopiert",
  "نسخ الرابط": "Link kopieren",
  "إرفاق رابط القراءة": "Leselink einschließen",
  "تم نسخ النص": "Text kopiert",
  "نسخ النص": "Text kopieren",
  "بطاقة الاقتباس": "Zitatkarte",
  "اقتباس من {bookTitle}": "Zitat aus {bookTitle}",
  "ابن القيم الجوزية رحمه الله":
    "Ibn Qayyim al-Dschauziyya, möge Allah ihm barmherzig sein",
  "تعذرت المشاركة المباشرة. يمكنك نسخ النص أو تحميل الصورة.":
    "Direktes Teilen ist fehlgeschlagen. Du kannst den Text kopieren oder das Bild herunterladen.",
  "المشاركة المباشرة غير مدعومة في هذا المتصفح. استخدم واتساب أو تليجرام أو نسخ النص.":
    "Direktes Teilen wird in diesem Browser nicht unterstützt. Nutze WhatsApp, Telegram oder kopiere den Text.",
  "تعذر فتح نافذة المشاركة. استخدم المشاركة المباشرة أو انسخ النص.":
    "Das Teilen-Fenster konnte nicht geöffnet werden. Nutze direktes Teilen oder kopiere den Text.",
  "تعذر نسخ الصورة. يمكنك تحميلها بدلا من ذلك.":
    "Bild konnte nicht kopiert werden. Lade es stattdessen herunter.",
  "اختيار لون {label}": "Farbe {label} wählen",
  "لون {color}": "Farbe {color}",
  "فإن في القلب شعثا لا يلمه إلا الإقبال على الله":
    "Im Herzen gibt es eine Zerstreuung, die nur die Hinwendung zu Allah sammelt.",
  مخطوط: "Manuskript",
  "ورق هادئ وحدود هندسية للنصوص الطويلة":
    "Ruhiges Papier und geometrische Rahmen für längere Texte",
  محراب: "Mihrab",
  "خلفية داكنة وعمق بصري مناسب للمشاركة":
    "Dunkler Hintergrund mit visueller Tiefe zum Teilen",
  "غلاف الكتاب": "Buchcover",
  "يربط البطاقة بلون الكتاب ومصدر الاقتباس":
    "Verbindet die Karte mit Buchfarbe und Zitatquelle",
  مربع: "Quadrat",
  قصة: "Story",
  ذهبي: "Gold",
  أخضر: "Grün",
  أزرق: "Blau",
  وردي: "Rosa",
  "أهلا بك في موروث ابن القيم": "Willkommen bei Ibn al-Qayyim Vermächtnis",
  "هذه جولة سريعة توضح كيف تبحث، تفتح كتابا، تنسخ النصوص، وتشارك اقتباسا منسقا كصورة قابلة للتعديل.":
    "Diese kurze Tour zeigt, wie du suchst, Bücher öffnest, Texte kopierst und ein formatiertes Zitat als bearbeitbares Bild teilst.",
  "ابدأ بالبحث": "Mit der Suche beginnen",
  "اكتب كلمة أو عبارة هنا للبحث في الكتب والفصول، ثم اضغط زر البحث للانتقال إلى النتائج.":
    "Gib hier ein Wort oder eine Phrase ein und drücke Suchen, um die Ergebnisse zu öffnen.",
  "افتح المكتبة": "Bibliothek öffnen",
  "من المكتبة يمكنك تصفح الأعمال المتاحة. اضغط أي بطاقة عمل للوصول إلى الطبعات ثم اختر الطبعة المناسبة.":
    "In der Bibliothek kannst du verfügbare Werke durchsuchen. Wähle ein Werk und öffne dann die passende Ausgabe.",
  "في صفحة الطبعة يظهر زر بدء القراءة. الجولة تستخدم أول طبعة متاحة كمثال حتى ترى المسار كاملا.":
    "Auf der Ausgabenseite erscheint die Schaltfläche zum Lesen. Die Tour nutzt die erste verfügbare Ausgabe als Beispiel, damit du den ganzen Weg siehst.",
  "في صفحة طبعة الداء والدواء من عطاءات العلم يظهر زر بدء القراءة، ومنها تكمل الجولة داخل القارئ.":
    "Auf der Ataat-al-Ilm-Ausgabenseite von Al-Daa wa al-Dawa erscheint die Schaltfläche zum Lesen; danach geht die Tour im Reader weiter.",
  "اقرأ الفصل": "Abschnitt lesen",
  "هذا هو سطح القراءة. مرر بين الصفحات، وسيحفظ الموقع موضعك محليا في هذا المتصفح.":
    "Dies ist der Reader. Scrolle durch die Seiten; die Website speichert deine Position lokal.",
  "اضبط تجربة القراءة": "Leseerlebnis anpassen",
  "من هذا الشريط تفتح المحتويات، تكبر أو تصغر الخط، تغير نوع الخط، وتظهر أو تخفي التشكيل.":
    "Über diese Leiste öffnest du den Inhalt, änderst Schriftgröße und Schriftart und blendest Vokalzeichen ein oder aus.",
  "انسخ نصا جاهزا للصق": "Text kopierfertig machen",
  "زر النسخ في أعلى القارئ ينسخ نص الفصل مع نسبة المصدر. بعد النسخ يمكنك لصقه في ملاحظاتك، بريدك، أو أي محرر نصوص.":
    "Die Kopieren-Schaltfläche oben im Reader kopiert den Abschnitt mit Quellenangabe. Danach kannst du ihn in Notizen, E-Mails oder einen Texteditor einfügen.",
  "النص المنسوخ يتضمن الكتاب والفصل.":
    "Der kopierte Text enthält Buch und Abschnitt.",
  "استخدمه عندما تريد حفظ الفصل أو جزء كبير منه خارج الموقع.":
    "Nutze dies, wenn du einen Abschnitt oder einen längeren Auszug außerhalb der Website speichern möchtest.",
  "حدد جزءا من النص": "Wähle einen Textteil",
  "ظلّل عبارة داخل الصفحة كما تفعل في أي قارئ. عند ترك التحديد يظهر شريط أعمال سريع في أسفل الشاشة.":
    "Markiere eine Passage auf der Seite wie in jedem Reader. Wenn du die Auswahl loslässt, erscheint unten eine Aktionsleiste.",
  "يمكنك تظليل العبارة، حفظ ملاحظة، نسخها، أو تحويلها إلى بطاقة مشاركة.":
    "Du kannst die Passage markieren, eine Notiz speichern, sie kopieren oder in eine Karte zum Teilen umwandeln.",
  "اختر ما تريد فعله بالاقتباس": "Wähle, was mit dem Zitat geschehen soll",
  "هذا مثال للشريط الذي يظهر بعد تحديد النص. زر النسخ يعطيك نصا منسقا للصق، وزر المشاركة يفتح بطاقة اقتباس جاهزة.":
    "Dies ist ein Beispiel für die Leiste nach einer Textauswahl. Kopieren liefert formatierten Text, Teilen öffnet eine fertige Zitatkarte.",
  "شارك جزءا منسقا": "Formatierten Auszug teilen",
  "عند الضغط على مشاركة، يولد الموقع بطاقة اقتباس بالصورة والمعنى: النص في الوسط، والمصدر محفوظ أسفل البطاقة.":
    "Beim Teilen erzeugt die Website eine Zitatkarte: Der Text steht in der Mitte, die Quelle bleibt unten erhalten.",
  "عدّل صورة الاقتباس": "Zitatbild bearbeiten",
  "من هذه اللوحة تستطيع اختيار قالب البطاقة، مقاس مربع أو قصة، إظهار المصدر، وتغيير ألوان التأكيد والخلفية قبل التصدير.":
    "In dieser Leiste wählst du Vorlage, Quadrat- oder Story-Format, Quellenanzeige sowie Akzent- und Hintergrundfarben vor dem Export.",
  "صدّر أو شارك": "Exportieren oder teilen",
  "بعد ضبط الصورة حمّلها، انسخ النص، أو استخدم المشاركة المباشرة عندما يدعمها المتصفح. هكذا يصبح الاقتباس جاهزا للنشر أو الحفظ.":
    "Nach dem Anpassen kannst du das Bild herunterladen, den Text kopieren oder direkt teilen, wenn der Browser es unterstützt. So ist das Zitat bereit zum Veröffentlichen oder Speichern.",
  "لم يظهر هذا الموضع بعد. يمكنك المتابعة، وستنتقل الجولة إلى الخطوة التالية.":
    "Dieses Ziel ist noch nicht sichtbar. Du kannst fortfahren; die Tour geht zum nächsten Schritt.",
  "خطوة {current} من {total}": "Schritt {current} von {total}",
  السابق: "Zurück",
  إنهاء: "Fertig",
  "ابدأ الجولة": "Tour starten",
  التالي: "Weiter",
  تخطي: "Überspringen",
  "الصفحة غير موجودة": "Seite nicht gefunden",
  "يبدو أن هذه الصفحة لا وجود لها أو أن الرابط خاطئ.":
    "Diese Seite existiert nicht oder der Link ist falsch.",
  "العودة إلى الرئيسية": "Zur Startseite",
};

const NUMBER = "([\\d٠-٩۰-۹.,٬]+)";
const TRANSLATIONS: Partial<Record<LanguageCode, Record<string, string>>> = {
  de: DE_TRANSLATIONS,
  en: EN_TRANSLATIONS,
};

const LOCALES: Record<LanguageCode, string> = {
  ar: "ar-SA-u-nu-latn",
  de: "de-DE",
  en: "en",
};

function toLatinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabic = "٠١٢٣٤٥٦٧٨٩".indexOf(digit);
    if (arabic !== -1) return String(arabic);
    const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
    return persian !== -1 ? String(persian) : digit;
  });
}

function translatePart(text: string, language: LanguageCode) {
  if (language === "ar") return text;
  return TRANSLATIONS[language]?.[text] ?? text;
}

function translatePattern(text: string, language: LanguageCode) {
  if (language !== "en") return text;

  let match = text.match(new RegExp(`^${NUMBER} من ${NUMBER} عمل$`));
  if (match)
    return `${toLatinDigits(match[1]!)} of ${toLatinDigits(match[2]!)} works`;

  match = text.match(new RegExp(`^${NUMBER} طبعات$`));
  if (match) return `${toLatinDigits(match[1]!)} editions`;

  match = text.match(new RegExp(`^${NUMBER} طبعات متاحة$`));
  if (match) return `${toLatinDigits(match[1]!)} editions available`;

  match = text.match(new RegExp(`^صفحة ${NUMBER}$`));
  if (match) return `Page ${toLatinDigits(match[1]!)}`;

  match = text.match(new RegExp(`^(.+) / صفحة ${NUMBER}$`));
  if (match) return `${match[1]} / page ${toLatinDigits(match[2]!)}`;

  match = text.match(new RegExp(`^${NUMBER} دقائق قراءة / صفحة ${NUMBER}$`));
  if (match)
    return `${toLatinDigits(match[1]!)} min read / page ${toLatinDigits(match[2]!)}`;

  match = text.match(new RegExp(`^${NUMBER} نتيجة للبحث عن "(.+)"$`));
  if (match) return `${toLatinDigits(match[1]!)} results for "${match[2]}"`;

  match = text.match(new RegExp(`^${NUMBER} تطابق$`));
  if (match) return `${toLatinDigits(match[1]!)} matches`;

  match = text.match(new RegExp(`^نسبة القراءة: ${NUMBER}%$`));
  if (match) return `Reading progress: ${toLatinDigits(match[1]!)}%`;

  match = text.match(/^خطوة ([\d٠-٩۰-۹]+) من ([\d٠-٩۰-۹]+)$/);
  if (match)
    return `Step ${toLatinDigits(match[1]!)} of ${toLatinDigits(match[2]!)}`;

  match = text.match(/^داخل قسم: (.+)$/);
  if (match) return `Within section: ${match[1]}`;

  match = text.match(/^داخل كتاب: (.+)$/);
  if (match) return `Within book: ${match[1]}`;

  match = text.match(/^قراءة (.+)$/);
  if (match) return `Read ${match[1]}`;

  match = text.match(/^تظليل (.+)$/);
  if (match) return `Highlight ${translatePart(match[1]!, "en").toLowerCase()}`;

  match = text.match(/^اختيار لون (.+)$/);
  if (match)
    return `Choose ${translatePart(match[1]!, "en").toLowerCase()} color`;

  match = text.match(/^لون (.+)$/);
  if (match) return `Color ${translatePart(match[1]!, "en")}`;

  match = text.match(/^اقتباس من (.+)$/);
  if (match) return `Quote from ${match[1]}`;

  if (text.includes(" / ")) {
    const translated = text
      .split(" / ")
      .map((part) => translatePart(part, "en"))
      .join(" / ");
    if (translated !== text) return translated;
  }

  return text;
}

export function translateText(value: string, language: LanguageCode) {
  if (language === "ar") return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return value;

  const translated =
    TRANSLATIONS[language]?.[normalized] ??
    translatePattern(normalized, language);
  if (translated === normalized) return value;
  return `${leading}${translated}${trailing}`;
}

export function translateUi(
  language: LanguageCode,
  key: string,
  params: Record<string, string | number> = {},
) {
  const translated = translateText(key, language);
  return Object.entries(params).reduce(
    (value, [name, replacement]) =>
      value.replaceAll(`{${name}}`, String(replacement)),
    translated,
  );
}

export function numberLocale(language: LanguageCode) {
  return LOCALES[language];
}

export function sortLocale(language: LanguageCode) {
  return language === "ar" ? "ar" : language === "de" ? "de" : "en";
}

export function formatNumber(value: number, language: LanguageCode) {
  return value.toLocaleString(numberLocale(language));
}

export function formatDate(value: number | Date, language: LanguageCode) {
  return new Date(value).toLocaleDateString(numberLocale(language));
}

export function editionCountText(count: number, language: LanguageCode) {
  if (language === "ar") {
    if (count === 1) return "طبعة واحدة";
    if (count === 2) return "طبعتان";
    return `${formatNumber(count, language)} طبعات`;
  }
  if (language === "de")
    return count === 1
      ? "1 Ausgabe"
      : `${formatNumber(count, language)} Ausgaben`;
  return count === 1
    ? "1 edition"
    : `${formatNumber(count, language)} editions`;
}

export function availableEditionsText(count: number, language: LanguageCode) {
  if (language === "ar") return `${formatNumber(count, language)} طبعات متاحة`;
  if (language === "de")
    return count === 1
      ? "1 Ausgabe verfügbar"
      : `${formatNumber(count, language)} Ausgaben verfügbar`;
  return count === 1
    ? "1 edition available"
    : `${formatNumber(count, language)} editions available`;
}

export function worksCountText(
  current: number,
  total: number,
  language: LanguageCode,
) {
  if (language === "ar")
    return `${formatNumber(current, language)} من ${formatNumber(total, language)} عمل`;
  if (language === "de")
    return `${formatNumber(current, language)} von ${formatNumber(total, language)} Werken`;
  return `${formatNumber(current, language)} of ${formatNumber(total, language)} works`;
}

export function pageText(pageNumber: number, language: LanguageCode) {
  if (language === "ar") return `صفحة ${formatNumber(pageNumber, language)}`;
  if (language === "de") return `Seite ${formatNumber(pageNumber, language)}`;
  return `Page ${formatNumber(pageNumber, language)}`;
}

export function readingMetaText(
  minutes: number,
  pageNumber: number,
  language: LanguageCode,
) {
  if (language === "ar")
    return `${formatNumber(minutes, language)} دقائق قراءة / ${pageText(pageNumber, language)}`;
  if (language === "de")
    return `${formatNumber(minutes, language)} Min. Lesezeit / ${pageText(pageNumber, language)}`;
  return `${formatNumber(minutes, language)} min read / ${pageText(pageNumber, language).toLowerCase()}`;
}

export function searchResultsText(
  count: number,
  query: string,
  language: LanguageCode,
) {
  if (language === "ar")
    return `${formatNumber(count, language)} نتيجة للبحث عن "${query}"`;
  if (language === "de")
    return `${formatNumber(count, language)} Ergebnisse für "${query}"`;
  return `${formatNumber(count, language)} results for "${query}"`;
}

export function matchCountText(count: number, language: LanguageCode) {
  if (language === "ar") return `${formatNumber(count, language)} تطابق`;
  if (language === "de")
    return count === 1
      ? "1 Treffer"
      : `${formatNumber(count, language)} Treffer`;
  return count === 1 ? "1 match" : `${formatNumber(count, language)} matches`;
}

export function useUiTranslations() {
  const { direction, language } = useLanguage();
  return {
    direction,
    formatDate: (value: number | Date) => formatDate(value, language),
    formatNumber: (value: number) => formatNumber(value, language),
    language,
    locale: numberLocale(language),
    sortLocale: sortLocale(language),
    t: (key: string, params?: Record<string, string | number>) =>
      translateUi(language, key, params),
  };
}
