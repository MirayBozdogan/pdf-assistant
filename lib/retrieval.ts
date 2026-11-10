import type { DocumentChunk } from "./chunks.ts";

export type SearchResult = { chunk: DocumentChunk; score: number };

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) throw new Error("Embedding dimensions do not match.");
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error("Invalid embedding value.");
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export function rankChunks(chunks: DocumentChunk[], embeddings: number[][], query: number[], limit = 3): SearchResult[] {
  if (chunks.length !== embeddings.length) throw new Error("Incomplete document index.");
  const ranked = chunks.map((chunk, i) => ({ chunk, score: cosineSimilarity(embeddings[i], query) }))
    .sort((a, b) => b.score - a.score || a.chunk.page - b.chunk.page || a.chunk.start - b.chunk.start);
  const results: SearchResult[] = [];
  for (const result of ranked) {
    // Avoid showing essentially the same overlapping passage twice.
    const duplicate = results.some(({ chunk }) => chunk.page === result.chunk.page &&
      Math.max(0, Math.min(chunk.end, result.chunk.end) - Math.max(chunk.start, result.chunk.start)) /
      Math.min(chunk.end - chunk.start, result.chunk.end - result.chunk.start) > 0.5);
    if (!duplicate) results.push(result);
    if (results.length >= limit) break;
  }
  return results;
}
