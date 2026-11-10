# PDF Assistant

A document assistant built with Next.js and TypeScript. Upload a PDF, search its contents by meaning, and open the source page for each matching passage.

## Features

- Extract text from PDFs up to 10 MB and 100 pages.
- Browse extracted text by page.
- Split text into overlapping passages while preserving source page numbers and character offsets.
- Search Turkish and other supported languages using multilingual embeddings and cosine similarity.
- Display up to three matching passages with links to their source pages.
- Reuse document embeddings for subsequent searches in the same session.

Results are original document excerpts, not AI-generated answers. Similarity ranking does not establish that a passage answers the question. Answer generation and AWS integration are not implemented yet.

## Stack

| Component | Purpose |
| --- | --- |
| Next.js App Router + TypeScript | User interface and embedding API |
| PDF.js | Browser-side PDF text extraction |
| Transformers.js + ONNX Runtime | Local CPU inference on the application server |
| `Xenova/multilingual-e5-small` (q8) | Multilingual retrieval embeddings, 384 dimensions |
| In-memory vector index | Passage retrieval using cosine similarity |

## Getting started

Use Node.js 22.13+ or Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Open the local URL shown in the terminal. Upload a text-based PDF and enter a question under **Belgede ara**. Click a source page to view the original extracted text.

The first search downloads model assets from Hugging Face and may take several minutes depending on the connection and CPU. Assets are cached in `.cache/models/`, which is excluded from Git. No API key or paid model service is needed. Later searches reuse the loaded model; document vectors remain in browser memory until another document is selected or the page is refreshed.

The `postinstall` script copies the PDF.js worker from the installed package into `public/` so its version matches the library.

## How retrieval works

1. Extract each page's text in the browser.
2. Create page-local windows of up to 400 characters with approximately 80 characters of overlap, preferring word boundaries.
3. Send passages in batches of up to eight to `POST /api/embeddings`.
4. Prefix passages with `passage:`, generate normalized embeddings with mean pooling and retain them in browser memory.
5. Embed the question with the same model and the `query:` prefix, then rank passages using cosine similarity.
6. Suppress heavily overlapping results and return up to three passages with their source pages.

Chunking uses character windows rather than tokenizer-aware sentence boundaries. Queries are limited to 500 characters. Inference requests are serialized within each server process to limit concurrent CPU use.

## Data handling

The PDF is read in the browser. During search, passages and the query are sent to this application's server for embedding. They are processed in memory, not written to disk or forwarded to a remote inference API. Only model assets are downloaded and cached. Google Fonts is used for interface typography.

The embedding endpoint has input and batch limits. Authentication, per-user rate limiting and production deployment controls are still required before exposing the application as a public service.

## Validation

```bash
npm test
npm run typecheck
npm run build
npm run test:semantic
```

Unit tests cover source coverage, page attribution, invalid chunk settings, vector ranking and duplicate suppression. The semantic check reports the expected source's rank for three Turkish paraphrase queries and enforces a baseline of at least two correct top results. The current q8 model ranks the login and return-policy passages first, but the shipping question can rank its correct passage behind unrelated results. This known retrieval weakness is reported rather than hidden by the test. This is a small smoke test, not a retrieval quality benchmark. Internet access is required on first run.

## Project structure

```text
app/page.tsx                 PDF upload and page reader
app/document-search.tsx      Search interface and session vector index
app/api/embeddings/route.ts  Validated embedding endpoint
lib/pdf.ts                   PDF extraction and file limits
lib/chunks.ts                Page-aware overlapping passages
lib/embeddings.ts            Local multilingual embedding inference
lib/model-cache.ts           Exact-byte model asset cache for Node.js
lib/retrieval.ts             Cosine ranking and duplicate suppression
tests/retrieval.test.ts      Chunking and retrieval tests
scripts/                    Worker setup and semantic smoke test
```

## Limitations and planned work

Scanned documents require OCR, which is not supported. Complex columns and tables may produce imperfect text order. Semantic search can return irrelevant passages, and the application does not currently infer whether the answer is absent. Large documents take longer to index.

Planned work includes grounded answer generation with source citations, retrieval evaluation, S3 document storage and Amazon Bedrock integration.

## References

- [Transformers.js documentation](https://huggingface.co/docs/transformers.js)
- [Embedding model](https://huggingface.co/Xenova/multilingual-e5-small)
- [PDF.js](https://mozilla.github.io/pdf.js/)
