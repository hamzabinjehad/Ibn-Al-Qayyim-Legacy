import org.apache.lucene.document.Document
import org.apache.lucene.index.DirectoryReader
import org.apache.lucene.index.LeafReaderContext
import org.apache.lucene.index.SortedDocValues
import org.apache.lucene.store.FSDirectory
import org.apache.lucene.util.BytesRef
import java.nio.file.Paths

def dir = FSDirectory.open(Paths.get("C:\\shamela4\\database\\store\\page"))
def reader = DirectoryReader.open(dir)

System.err.println("Total docs: ${reader.numDocs()}")

// Sample book IDs from DocValues
def bookIdSamples = new LinkedHashMap()
def firstWithFoot = []

for (LeafReaderContext ctx : reader.leaves()) {
    def leaf = ctx.reader()
    def bookDV = leaf.getSortedDocValues("book")  // SortedDocValues
    def pageDV = leaf.getSortedDocValues("page")  // SortedDocValues

    for (int docId = 0; docId < leaf.maxDoc(); docId++) {
        // Get book ID
        String bookId = null
        if (bookDV != null && bookDV.advanceExact(docId)) {
            bookId = bookDV.lookupOrd(bookDV.ordValue()).utf8ToString()
        }

        // Get stored body/foot
        def storedDoc = leaf.storedFields().document(docId)
        def body = storedDoc.get("body")
        def foot = storedDoc.get("foot")

        if (bookId && !bookIdSamples.containsKey(bookId)) {
            String pageVal = null
            if (pageDV != null && pageDV.advanceExact(docId)) {
                pageVal = pageDV.lookupOrd(pageDV.ordValue()).utf8ToString()
            }
            bookIdSamples[bookId] = [page: pageVal, bodyLen: body?.length() ?: 0, footLen: foot?.length() ?: 0]
        }

        if (foot?.trim() && firstWithFoot.size() < 3) {
            firstWithFoot << [book: bookId, foot: foot.take(200)]
        }

        if (bookIdSamples.size() >= 80 && firstWithFoot.size() >= 3) break
    }
    if (bookIdSamples.size() >= 80) break
}

println "=== Sample book IDs (DocValues) ==="
bookIdSamples.each { bookId, info ->
    println "book=${bookId}  page=${info.page}  bodyLen=${info.bodyLen}  footLen=${info.footLen}"
}

println "\n=== Sample pages with footnotes ==="
firstWithFoot.each { s ->
    println "book=${s.book}: ${s.foot}"
    println "---"
}

reader.close()
dir.close()
