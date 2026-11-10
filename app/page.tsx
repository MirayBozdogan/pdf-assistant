"use client";

import { useRef, useState } from "react";
import { extractPdf, type PdfText } from "../lib/pdf";

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<PdfText | null>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    setDocument(null);
    setFilename(file.name);
    setSelectedPage(1);
    setProgress("PDF açılıyor…");
    try {
      const result = await extractPdf(file, (page, total) => setProgress(`${page} / ${total} sayfa okunuyor…`));
      setDocument(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF okunamadı. Başka bir belgeyle tekrar deneyin.");
    } finally {
      setBusy(false);
      setProgress("");
      if (input.current) input.current.value = "";
    }
  }

  const page = document?.pages[selectedPage - 1];

  return (
    <main className="shell">
      <header className="header">
        <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">P</span> PDF Assistant</a>
        <span className="workspace-label">Belge çalışma alanı</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ÇALIŞMA ALANI</p>
        <h1>Belgelerinize <span>yakından bakın.</span></h1>
        <p className="lead">PDF yükleyin, içeriğini sayfa sayfa inceleyin.</p>
      </section>

      <div className="workspace">
        <section className="upload-card" aria-labelledby="upload-title">
          <div className="section-label">BELGENİZ</div>
          <h2 id="upload-title">PDF yükle</h2>
          <p className="muted">Metin içeren PDF belgeleri desteklenir.</p>
          <div className="upload-area">
            <div className="file-icon" aria-hidden="true">PDF</div>
            <h3>İncelemek istediğiniz belgeyi seçin</h3>
            <p>En fazla 10 MB · 100 sayfa</p>
            <input ref={input} id="pdf-file" type="file" accept=".pdf,application/pdf" disabled={busy} aria-label="PDF dosyası seç" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Belge okunuyor…" : document ? "Başka PDF seç" : "PDF seç"}<span aria-hidden="true"> ↑</span></button>
          </div>
          <p className="privacy">Dosyanız tarayıcınızda işlenir, sunucuya gönderilmez.</p>
          <div role="status" aria-live="polite">{busy && <p className="notice">{progress}</p>}</div>
          {error && <p role="alert" className="error">{error}</p>}
          {document && <div className="file-summary"><span className="check" aria-hidden="true">✓</span><div><strong>{filename}</strong><span>{document.pages.length} sayfa · {document.characterCount.toLocaleString("tr-TR")} karakter</span></div></div>}
        </section>

        <section className="reader-card" aria-labelledby="reader-title">
          <div className="reader-heading"><div><div className="section-label">İÇERİK</div><h2 id="reader-title">Belge içeriği</h2></div>{document && <label className="page-select">Sayfa <select aria-label="Görüntülenecek sayfa" value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))}>{document.pages.map((item) => <option key={item.number} value={item.number}>{item.number} / {document.pages.length}</option>)}</select></label>}</div>
          {document ? <><div className="source-label">{filename} · Sayfa {selectedPage}</div>{document.characterCount === 0 && <p role="status" className="notice">Bu belgede okunabilir metin bulunamadı. Taranmış belgeler desteklenmiyor. Lütfen metni seçilebilen bir PDF yükleyin.</p>}<div className="page-text" tabIndex={0} aria-label={`Sayfa ${selectedPage} metni`}>{page?.text || "Bu sayfada okunabilir metin bulunamadı."}</div><p className="reader-note">Belge düzenine bağlı olarak metin sırası farklılık gösterebilir.</p></> : <div className="empty-state"><div className="text-lines" aria-hidden="true"><i /><i /><i /></div><h3>{busy ? "Belgeniz hazırlanıyor" : "Henüz bir belge seçilmedi"}</h3><p>{busy ? "Belgenin uzunluğuna göre bu işlem birkaç saniye sürebilir." : "İçeriği görüntülemek için bir PDF yükleyin."}</p></div>}
        </section>
      </div>
      <footer>PDF Assistant <span>Belgeleriniz sizin kontrolünüzde.</span></footer>
    </main>
  );
}
