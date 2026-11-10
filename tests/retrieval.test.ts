import test from "node:test";
import assert from "node:assert/strict";
import { chunkDocument } from "../lib/chunks.ts";
import { cosineSimilarity, rankChunks } from "../lib/retrieval.ts";

test("chunks preserve every source character, page and offset, including Turkish text", () => {
  const text = "Başvuru koşulları: Öğrenciler kimlik belgesi sunmalıdır. ".repeat(35);
  const pages = [{ number: 1, text }, { number: 2, text: "  " }, { number: 3, text: "İade süresi on dört gündür." }];
  const chunks = chunkDocument({ pages, characterCount: text.length + 28 });
  for (const page of [pages[0], pages[2]]) {
    const coverage = new Set<number>();
    for (const chunk of chunks.filter((item) => item.page === page.number)) {
      assert.equal(chunk.text, page.text.slice(chunk.start, chunk.end));
      assert.ok(chunk.text.length <= 400);
      for (let i = chunk.start; i < chunk.end; i++) coverage.add(i);
    }
    assert.equal(coverage.size, page.text.length);
  }
  assert.ok(!chunks.some((chunk) => chunk.page === 2));
  assert.equal(new Set(chunks.map((chunk) => chunk.id)).size, chunks.length);
});

test("invalid overlap cannot cause a non-terminating chunk loop", () => {
  assert.throws(() => chunkDocument({ pages: [], characterCount: 0 }, 400, 400));
  assert.throws(() => chunkDocument({ pages: [], characterCount: 0 }, 0, 0));
});

test("search uses vector direction rather than magnitude and suppresses duplicate passages", () => {
  const chunks = [
    { id: "1", page: 1, text: "A", start: 0, end: 400 },
    { id: "2", page: 1, text: "B", start: 100, end: 500 },
    { id: "3", page: 2, text: "C", start: 0, end: 400 },
  ];
  const results = rankChunks(chunks, [[1, 0], [9, 1], [0, 100]], [1, 0]);
  assert.deepEqual(results.map(({ chunk }) => chunk.id), ["1", "3"]);
  assert.equal(cosineSimilarity([0, 0], [1, 2]), 0);
  assert.throws(() => cosineSimilarity([1], [1, 2]));
  assert.throws(() => cosineSimilarity([NaN], [1]));
  assert.throws(() => rankChunks(chunks, [], [1, 0]));
});

test("empty and image-only documents produce no searchable chunks", () => {
  assert.deepEqual(chunkDocument({ pages: [], characterCount: 0 }), []);
  assert.deepEqual(chunkDocument({ pages: [{ number: 1, text: "" }], characterCount: 0 }), []);
});
