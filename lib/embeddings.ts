import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { createModelCache } from "./model-cache.ts";

export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
env.cacheDir = path.join(process.cwd(), ".cache", "models");
env.allowLocalModels = false;
env.useFSCache = false;
env.useCustomCache = true;
env.customCache = createModelCache(env.cacheDir, EMBEDDING_MODEL);

let extractor: Promise<FeatureExtractionPipeline> | undefined;
// Serialize inference to keep CPU/memory use bounded across concurrent requests.
let queue: Promise<unknown> = Promise.resolve();

export function embedTexts(texts: string[], kind: "passage" | "query" = "passage"): Promise<number[][]> {
  const run = queue.then(async () => {
    if (!extractor) {
      extractor = pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8", device: "cpu" })
        .catch((error) => { extractor = undefined; throw error; });
    }
    const model = await extractor;
    const output = await model(texts.map((text) => `${kind}: ${text}`), { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function disposeEmbeddingModel() {
  await queue;
  if (extractor) await (await extractor).dispose();
  extractor = undefined;
}
