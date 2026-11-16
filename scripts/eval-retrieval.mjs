import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { embedTexts, disposeEmbeddingModel, EMBEDDING_MODEL } from "../lib/embeddings.ts";
import { chunkDocument } from "../lib/chunks.ts";
import { rankChunks } from "../lib/retrieval.ts";

// Reports retrieval quality on a fixed Turkish dataset and fails only if it drops below the recorded baseline.
const data = JSON.parse(await readFile(new URL("./retrieval-eval.json", import.meta.url), "utf8"));
const pages = data.pages;
const chunks = chunkDocument({ pages, characterCount: pages.reduce((sum, page) => sum + page.text.length, 0) });
const SHOWN = 3; // The search UI shows three passages.
const BASELINE = { top1: 14, shown: 17 }; // Measured with q8 multilingual-e5-small; raise when retrieval improves.

try {
  const vectors = [];
  for (let i = 0; i < chunks.length; i += 8) vectors.push(...await embedTexts(chunks.slice(i, i + 8).map((chunk) => chunk.text)));
  const questions = [];
  for (let i = 0; i < data.queries.length; i += 8) questions.push(...await embedTexts(data.queries.slice(i, i + 8).map((query) => query.text), "query"));

  assert.equal(vectors[0].length, 384);

  const rows = data.queries.map((query, i) => {
    // Full ranking (duplicates suppressed as in the UI) so ranks beyond the visible three are measurable.
    const ranked = rankChunks(chunks, vectors, questions[i], chunks.length);
    const rank = query.pages.length ? ranked.findIndex(({ chunk }) => query.pages.includes(chunk.page)) + 1 : 0;
    return { ...query, rank, topScore: ranked[0].score, topPage: ranked[0].chunk.page };
  });

  console.log(`${chunks.length} passages from ${pages.length} pages; ${rows.length} queries.\n`);
  for (const row of rows) {
    const label = row.type === "negative" ? "NEGATIVE" : row.rank === 1 ? "TOP-1" : row.rank <= SHOWN ? "SHOWN" : "MISSED";
    const expected = row.pages.length ? `expected p.${row.pages.join("/")}, rank ${row.rank}` : "no answer in document";
    console.log(`${label.padEnd(8)} ${row.type.padEnd(10)} top p.${row.topPage} score ${row.topScore.toFixed(3)} | ${expected} | ${row.text}`);
  }

  const summarize = (subset) => {
    const n = subset.length;
    const top1 = subset.filter((row) => row.rank === 1).length;
    const shown = subset.filter((row) => row.rank >= 1 && row.rank <= SHOWN).length;
    const mrr = subset.reduce((sum, row) => sum + (row.rank ? 1 / row.rank : 0), 0) / n;
    return `top-1 ${top1}/${n}, recall@${SHOWN} ${shown}/${n}, MRR ${mrr.toFixed(2)}`;
  };
  const answerable = rows.filter((row) => row.type !== "negative");
  console.log("\nSummary");
  for (const type of [...new Set(answerable.map((row) => row.type))]) {
    console.log(`  ${type.padEnd(10)} ${summarize(answerable.filter((row) => row.type === type))}`);
  }
  console.log(`  ${"all".padEnd(10)} ${summarize(answerable)}`);

  // Shows whether a similarity threshold could separate unanswerable queries; no threshold is applied in the app.
  const negatives = rows.filter((row) => row.type === "negative").map((row) => row.topScore);
  const correct = answerable.filter((row) => row.rank === 1).map((row) => row.topScore);
  if (negatives.length && correct.length) {
    console.log(`\nTop score, negative queries: ${Math.min(...negatives).toFixed(3)}–${Math.max(...negatives).toFixed(3)}`);
    console.log(`Top score, correct top-1 answers: ${Math.min(...correct).toFixed(3)}–${Math.max(...correct).toFixed(3)}`);
  }
  const top1 = answerable.filter((row) => row.rank === 1).length;
  const shown = answerable.filter((row) => row.rank >= 1 && row.rank <= SHOWN).length;
  assert.ok(top1 >= BASELINE.top1 && shown >= BASELINE.shown, `Retrieval regressed below baseline (top-1 ${BASELINE.top1}, recall@${SHOWN} ${BASELINE.shown})`);
  console.log(`\nModel: ${EMBEDDING_MODEL}. Synthetic dataset; not a general benchmark.`);
} finally {
  await disposeEmbeddingModel();
}
