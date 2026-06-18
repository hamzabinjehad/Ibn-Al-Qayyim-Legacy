import org.apache.lucene.index.DirectoryReader
import org.apache.lucene.index.LeafReaderContext
import org.apache.lucene.index.FieldInfos
import org.apache.lucene.index.FieldInfo
import org.apache.lucene.index.DocValuesType
import org.apache.lucene.store.FSDirectory
import java.nio.file.Paths

def dir = FSDirectory.open(Paths.get("C:\\shamela4\\database\\store\\page"))
def reader = DirectoryReader.open(dir)
def leaf = reader.leaves()[0].reader()

// Show field info (stored vs docvalues type)
println "=== Field Info ==="
leaf.fieldInfos.each { FieldInfo fi ->
    println "  ${fi.name}: docValuesType=${fi.docValuesType}, stored=${fi.name}"
}

// Try to read book field using NumericDocValues
println "\n=== Try reading book as NumericDocValues ==="
def numericBook = leaf.getNumericDocValues("book")
if (numericBook != null) {
    println "book is NumericDocValues!"
    numericBook.nextDoc()
    println "First value: ${numericBook.longValue()}"
} else {
    println "book is NOT numeric"
}

// Try SortedDocValues
println "\n=== Try reading book as SortedDocValues ==="
def sortedBook = leaf.getSortedDocValues("book")
if (sortedBook != null) {
    println "book is SortedDocValues!"
    sortedBook.nextDoc()
    println "First value: ${sortedBook.lookupOrd(sortedBook.ordValue()).utf8ToString()}"
} else {
    println "book is NOT sorted"
}

// Try Binary
println "\n=== Try reading book as BinaryDocValues ==="
def binaryBook = leaf.getBinaryDocValues("book")
if (binaryBook != null) {
    println "book is BinaryDocValues!"
    binaryBook.nextDoc()
    println "First value: ${binaryBook.binaryValue().utf8ToString()}"
} else {
    println "book is NOT binary"
}

// Sample first 5 docs with whatever fields we can get
println "\n=== Sample pages with stored fields ==="
def storedFields = leaf.storedFields()
for (int i = 0; i < 5; i++) {
    def doc = storedFields.document(i)
    println "Doc ${i}: fields=${doc.fields*.name}"
    doc.fields.each { f ->
        println "  ${f.name()} = ${f.stringValue()?.take(80) ?: '[non-string]'}"
    }
}

reader.close()
dir.close()
