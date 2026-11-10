export type PdfText = {
  pages: { number: number; text: string }[];
  characterCount: number;
};

export async function extractPdf(file: File, onProgress: (page: number, total: number) => void): Promise<PdfText> {
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Lütfen .pdf uzantılı bir dosya seçin.");
  if (file.size === 0) throw new Error("Bu dosya boş. Başka bir PDF seçin.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Dosya 10 MB sınırını aşıyor. Daha küçük bir PDF seçin.");

  const data = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder().decode(data.subarray(0, 1024));
  if (!signature.includes("%PDF-")) throw new Error("Dosyanın içeriği geçerli bir PDF olarak tanınmadı.");

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data });

  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("En fazla 100 sayfalık belgeler desteklenir. Daha kısa bir belge seçin.");
    const pages: PdfText["pages"] = [];
    let characterCount = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      onProgress(number, pdf.numPages);
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      pages.push({ number, text });
      characterCount += text.length;
      page.cleanup();
    }
    return { pages, characterCount };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "PasswordException") throw new Error("Bu PDF parola korumalı. Parolasız bir PDF seçin.");
    if (cause instanceof Error && cause.name === "InvalidPDFException") throw new Error("PDF bozuk veya okunamıyor. Başka bir belgeyle deneyin.");
    throw cause;
  } finally {
    await task.destroy();
  }
}
