import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createModelCache } from "../lib/model-cache.ts";

test("small cached JSON files return exact bytes, without backing-buffer padding", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pdf-model-cache-"));
  try {
    const cache = createModelCache(root, "Xenova/multilingual-e5-small");
    const url = "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/tokenizer_config.json";
    const content = JSON.stringify({ name: "Türkçe", size: 384 });
    await cache.put(url, new Response(content));
    const response = await cache.match(url);
    assert.ok(response);
    assert.equal((await response.arrayBuffer()).byteLength, new TextEncoder().encode(content).length);
    assert.deepEqual(await (await cache.match(url))!.json(), JSON.parse(content));
    assert.equal(await cache.match(url.replace("tokenizer_config.json", "../other.json")), undefined);
    assert.equal(await cache.match(url.replace("huggingface.co", "other.example")), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
