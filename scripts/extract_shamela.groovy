import org.apache.lucene.index.DirectoryReader
import org.apache.lucene.index.LeafReaderContext
import org.apache.lucene.store.FSDirectory
import java.nio.file.Paths
import java.nio.charset.StandardCharsets

// Ibn Al-Qayyim book IDs (numeric) from master.db
def IBN_QAYYIM_IDS = [
    134L,158L,184L,197L,199L,201L,205L,212L,216L,218L,229L,251L,252L,253L,257L,
    390L,417L,928L,1477L,5705L,6266L,6275L,6462L,6666L,6829L,6832L,6840L,6841L,
    7345L,7513L,7572L,7632L,7661L,8370L,8566L,9388L,10713L,11147L,11229L,11274L,
    11329L,11375L,11495L,11496L,11688L,11797L,12003L,12021L,12029L,13652L,14211L,
    16422L,17798L,18124L,18128L,18152L,18159L,18169L,18318L,18337L,18612L,18632L,
    19225L,21713L,21714L,21747L,22707L,23606L,23649L,29911L,30842L,98093L,
    145410L,145411L
] as Set

def escapeJson(String s) {
    if (!s) return ""
    s.replace('\\', '\\\\')
     .replace('"', '\\"')
     .replace('\n', '\\n')
     .replace('\r', '\\r')
     .replace('\t', '\\t')
}

def outputPath = args.length > 0 ? args[0] : "C:\\Users\\hamza\\AppData\\Local\\Temp\\shamela_footnotes.json"
System.err.println("Output: ${outputPath}")

def dir = FSDirectory.open(Paths.get("C:\\shamela4\\database\\store\\page"))
def reader = DirectoryReader.open(dir)
System.err.println("Total docs: ${reader.numDocs()}")

def out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(outputPath), StandardCharsets.UTF_8))
out.println("[")
boolean first = true
int count = 0
int withFoot = 0

for (LeafReaderContext ctx : reader.leaves()) {
    def leaf = ctx.reader()
    def bookDV = leaf.getNumericDocValues("book")
    def pageDV = leaf.getNumericDocValues("page")
    def storedFields = leaf.storedFields()

    for (int docId = 0; docId < leaf.maxDoc(); docId++) {
        // Get book ID via NumericDocValues
        long bookId = -1
        if (bookDV != null && bookDV.advanceExact(docId)) {
            bookId = bookDV.longValue()
        }
        if (!IBN_QAYYIM_IDS.contains(bookId)) continue

        // Get page number
        long pageNum = -1
        if (pageDV != null && pageDV.advanceExact(docId)) {
            pageNum = pageDV.longValue()
        }

        // Get stored fields
        def doc = storedFields.document(docId)
        def id   = doc.get("id")   // format: "bookId-pageNum"
        def foot = doc.get("foot") // footnote HTML

        if (!first) out.print(",")
        first = false

        def footVal = foot?.trim() ?: ""
        if (footVal) withFoot++

        out.println()
        out.print('{"book":' + bookId)
        out.print(',"page":' + pageNum)
        out.print(',"id":"' + escapeJson(id) + '"')
        out.print(',"foot":"' + escapeJson(footVal) + '"}')

        count++
        if (count % 2000 == 0) System.err.println("  ${count} pages extracted...")
    }
}

out.println()
out.println("]")
out.close()
reader.close()
dir.close()

System.err.println("Done. Extracted: ${count} pages, ${withFoot} with footnotes")
