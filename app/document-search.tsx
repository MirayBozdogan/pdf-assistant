"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { PdfText } from "../lib/pdf";
import { chunkDocument } from "../lib/chunks";
import { rankChunks, type SearchResult } from "../lib/retrieval";

async function embed(texts: string[], signal: AbortSignal, kind: "passage" | "query" = "passage"): Promise<number[][]> {
  const response = await fetch("/api/embeddings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, kind }), signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Arama tamamlanamadı. Tekrar deneyin.");
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length ||
    !data.embeddings.every((vector: unknown) => Array.isArray(vector) && vector.length === 384 && vector.every(Number.isFinite))) {
    throw new Error("Arama sonucunda geçersiz veri alındı. Tekrar deneyin.");
  }
  return data.embeddings;
}

export default function DocumentSearch({ document, onSource }: { document: PdfText | null; onSource: (page: number) => void }) {
  const chunks = useMemo(() => document ? chunkDocument(document) : [], [document]);
  const vectors = useRef<number[][]>([]);
  const controller = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const question = query.trim();
    if (!question || !chunks.length || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(""); setResults(null); setSearchedQuery(question);
    try {
      for (let i = vectors.current.length; i < chunks.length; i += 8) {
        setStatus(i === 0 ? "Arama hazırlanıyor. İlk kullanım daha uzun sürebilir…" : `Belge hazırlanıyor · ${Math.round(i / chunks.length * 100)}%`);
        const batch = await embed(chunks.slice(i, i + 8).map((chunk) => chunk.text), abort.signal);
        if (abort.signal.aborted) return;
        vectors.current.push(...batch);
      }
      setStatus("İlgili bölümler aranıyor…");
      const [questionVector] = await embed([question], abort.signal, "query");
      if (!abort.signal.aborted) setResults(rankChunks(chunks, vectors.current, questionVector));
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Arama tamamlanamadı.");
    } finally {
      if (!abort.signal.aborted) { setBusy(false); setStatus(""); }
    }
  }

  return <section className="search-card" aria-labelledby="search-title">
    <div className="section-label">ARAMA</div>
    <h2 id="search-title">Belgede ara</h2>
    <p className="muted">Bir soru sorun veya aradığınız konuyu yazın. Anlamca en yakın belge bölümlerini bulun.</p>
    <form onSubmit={search} className="search-form">
      <label className="sr-only" htmlFor="document-query">Belgede aranacak soru veya konu</label>
      <input id="document-query" value={query} maxLength={500} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. Başvuru için hangi belgeler gerekiyor?" disabled={!chunks.length || busy} />
      <button type="submit" disabled={!chunks.length || !query.trim() || busy}>{busy ? "Aranıyor…" : "Ara"}</button>
    </form>
    {!chunks.length && <p className="search-hint">Arama yapmak için metin içeren bir PDF yükleyin.</p>}
    <div role="status" aria-live="polite">{status && <p className="notice">{status}</p>}</div>
    {error && <p role="alert" className="error">{error}</p>}
    {results && <div className="search-results"><p className="results-heading">“{searchedQuery}” için ilgili bölümler</p><p className="search-hint">Bunlar belgeden alınan bölümlerdir. Arama sonuçları, sorunuzun cevabını içerdiğini garanti etmez.</p><ol>{results.map(({ chunk }) => <li key={chunk.id}><button type="button" className="source-button" onClick={() => onSource(chunk.page)}>Sayfa {chunk.page} <span aria-hidden="true">↗</span></button><p>{chunk.text}</p></li>)}</ol></div>}
  </section>;
}
