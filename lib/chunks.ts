import type { PdfText } from "./pdf";

export type DocumentChunk = {
  id: string;
  page: number;
  text: string;
  start: number;
  end: number;
};

// Page-local windows retain exact source offsets; overlap preserves boundary context.
export function chunkDocument(document: PdfText, size = 400, overlap = 80): DocumentChunk[] {
  if (!Number.isInteger(size) || !Number.isInteger(overlap) || size < 2 || overlap < 0 || overlap >= size) {
    throw new Error("Invalid chunk size or overlap.");
  }
  const chunks: DocumentChunk[] = [];
  for (const page of document.pages) {
    let start = 0;
    while (start < page.text.length) {
      let end = Math.min(start + size, page.text.length);
      // Prefer a word boundary without creating tiny windows.
      if (end < page.text.length) {
        const boundary = page.text.lastIndexOf(" ", end);
        if (boundary > start + size * 0.65) end = boundary;
        // Do not split a UTF-16 surrogate pair.
        if (/[\uD800-\uDBFF]/.test(page.text[end - 1])) end--;
      }
      const text = page.text.slice(start, end);
      if (text.trim()) chunks.push({ id: `${page.number}:${start}`, page: page.number, text, start, end });
      if (end === page.text.length) break;
      start = Math.max(start + 1, end - overlap);
      if (/[\uDC00-\uDFFF]/.test(page.text[start])) start++;
    }
  }
  return chunks;
}
