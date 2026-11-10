import assert from "node:assert/strict";
import { embedTexts, disposeEmbeddingModel, EMBEDDING_MODEL } from "../lib/embeddings.ts";
import { chunkDocument } from "../lib/chunks.ts";
import { rankChunks } from "../lib/retrieval.ts";

const pages = [
  { number: 1, text: "Hesabınıza giriş yapmak için e-posta adresiniz ve şifreniz gerekir." },
  { number: 2, text: "İadeler, ürün tesliminden itibaren on dört gün içinde yapılabilir." },
  { number: 3, text: "Gönderiler en geç üç iş gününde alıcıya ulaştırılır." },
];
const chunks = chunkDocument({ pages, characterCount: pages.reduce((sum, page) => sum + page.text.length, 0) });
const queries = [
  { text: "Oturum nasıl açılır?", page: 1 },
  { text: "Satın aldığım şeyi geri vermek için ne kadar vaktim var?", page: 2 },
  { text: "Kargom ne zaman gelir?", page: 3 },
];
try {
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
  const questions = await embedTexts(queries.map((query) => query.text), "query");
  assert.equal(embeddings[0].length, 384);
  let topOne = 0;
  let topTwo = 0;
  for (let i = 0; i < queries.length; i++) {
    const results = rankChunks(chunks, embeddings, questions[i]);
    const rank = results.findIndex(({ chunk }) => chunk.page === queries[i].page) + 1;
    // Track retrieval quality explicitly, including difficult queries.
    assert.ok(rank > 0, queries[i].text);
    if (rank === 1) topOne++;
    if (rank <= 2) topTwo++;
    console.log(`${rank === 1 ? "TOP-1" : "LOWER-RANK"}: ${queries[i].text} → source page ${queries[i].page}, rank ${rank}`);
  }
  assert.ok(topOne >= 2, "Top-1 smoke-test baseline regressed");
  console.log(`Top-1: ${topOne}/${queries.length}; recall@2: ${topTwo}/${queries.length}. Small smoke test only.`);
  console.log(`Verified real multilingual embeddings: ${EMBEDDING_MODEL}`);
} finally {
  await disposeEmbeddingModel();
}
