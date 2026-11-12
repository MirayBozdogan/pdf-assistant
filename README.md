# PDF Assistant

A document assistant built with Next.js and TypeScript. Upload a PDF, search its contents by meaning, and generate answers with source quotes through Amazon Bedrock when configured.

## Features

- Extract text from PDFs up to 10 MB and 100 pages.
- Browse extracted text by page.
- Split text into overlapping passages while preserving source page numbers and character offsets.
- Search Turkish and other supported languages using multilingual embeddings and cosine similarity.
- Display up to three matching passages with links to their source pages.
- Reuse document embeddings for subsequent searches in the same session.
- Generate Turkish answers from retrieved excerpts with Amazon Bedrock's Converse API.
- Require each answer claim to reference a supplied excerpt and include a verifiable quote.
- Show source page links and expandable supporting quotes.

Search results are original excerpts. Answer generation is a separate, explicit action and requires AWS configuration. If the model reports insufficient evidence, the UI says that the inspected excerpts do not contain enough information. The application does not claim that the entire PDF lacks an answer.

## Stack

| Component | Purpose |
| --- | --- |
| Next.js App Router + TypeScript | User interface and embedding API |
| PDF.js | Browser-side PDF text extraction |
| Transformers.js + ONNX Runtime | Local CPU inference on the application server |
| `Xenova/multilingual-e5-small` (q8) | Multilingual retrieval embeddings, 384 dimensions |
| In-memory vector index | Passage retrieval using cosine similarity |
| AWS SDK for JavaScript + Bedrock Converse | Grounded answer generation on the application server |

## Getting started

Use Node.js 22.13+ or Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Open the local URL shown in the terminal. Upload a text-based PDF and enter a question under **Belgede ara**. Click a source page to view the original extracted text.

The first search downloads model assets from Hugging Face and may take several minutes depending on the connection and CPU. Assets are cached in `.cache/models/`, which is excluded from Git. Local search does not require an API key or paid model service. Later searches reuse the loaded model; document vectors remain in browser memory until another document is selected or the page is refreshed.

The `postinstall` script copies the PDF.js worker from the installed package into `public/` so its version matches the library.

## Configure answer generation

Copy `.env.example` to `.env.local` and set `AWS_REGION` and `BEDROCK_MODEL_ID` to a region and model or inference profile available to your AWS account. Restart the development server after changing environment settings. No model or region is silently selected by the application.

Authenticate locally through the AWS SDK's default credential chain, for example an AWS CLI profile with IAM Identity Center (`aws sso login --profile your-profile`, then set `AWS_PROFILE`). When deploying on AWS, use an IAM role. The identity needs `bedrock:InvokeModel` for the selected model/profile and, where applicable, its destination model resources. Refer to AWS documentation for the exact policy required for your model and region.

Do not put credentials in client code, commit secrets, or prefix these settings with `NEXT_PUBLIC_`. No real credentials are included in the repository. AWS inference usage may incur charges.

Search first, then click **Cevap oluştur**. This sends only the question and the retrieved excerpts to Bedrock, not the full PDF. Local search still works without Bedrock configuration; requesting an answer returns a clear unavailable message until configuration is complete.

### Answer validation

The model receives separate system instructions and JSON-encoded question/excerpts. Excerpts are explicitly treated as untrusted data. The response must be JSON with either `not_found` and no claims or `answered` and one to six claims. Each claim must reference an existing excerpt and quote text that occurs there, with normalized whitespace. Page numbers come from the original excerpt metadata, not the model. Invalid, incomplete or blocked responses are rejected; the application does not silently substitute a generated answer or automatically retry a paid request.

Quote validation verifies provenance, not logical entailment. A real quote can still be paired with a misleading claim. Prompt instructions also do not eliminate prompt injection. Users should compare important information against the displayed source. Live model quality evaluation is still required.

## How retrieval works

1. Extract each page's text in the browser.
2. Create page-local windows of up to 400 characters with approximately 80 characters of overlap, preferring word boundaries.
3. Send passages in batches of up to eight to `POST /api/embeddings`.
4. Prefix passages with `passage:`, generate normalized embeddings with mean pooling and retain them in browser memory.
5. Embed the question with the same model and the `query:` prefix, then rank passages using cosine similarity.
6. Suppress heavily overlapping results and return up to three passages with their source pages.

Chunking uses character windows rather than tokenizer-aware sentence boundaries. Queries are limited to 500 characters. Inference requests are serialized within each server process to limit concurrent CPU use.

## Data handling

The PDF is read in the browser. During search, passages and the query are sent to this application's server for local embedding. When the user explicitly requests an answer, only the question and selected passages are forwarded to Amazon Bedrock. The application does not persist document text, questions or answers to disk; AWS processing and retention are governed by the configured account/service policies. Model assets are downloaded and cached. Google Fonts is used for interface typography.

The embedding endpoint has input and batch limits. Authentication, per-user rate limiting and production deployment controls are still required before exposing the application as a public service.

## Validation

```bash
npm test
npm run typecheck
npm run build
npm run test:semantic
```

Unit tests cover source coverage, page attribution, invalid chunk settings, vector ranking and duplicate suppression. The semantic check reports the expected source's rank for three Turkish paraphrase queries and enforces a baseline of at least two correct top results. The current q8 model ranks the login and return-policy passages first, but the shipping question can rank its correct passage behind unrelated results. This known retrieval weakness is reported rather than hidden by the test. This is a small smoke test, not a retrieval quality benchmark. Internet access is required on first run.

Answer tests use synthetic responses to check fabricated citations, invented quotes, page attribution, missing evidence, malformed output and unconfigured provider behavior. They do not make paid AWS calls or establish live answer quality. Live Bedrock testing requires valid AWS authentication and a selected model.

## Project structure

```text
app/page.tsx                 PDF upload and page reader
app/document-search.tsx      Search interface and session vector index
app/api/embeddings/route.ts  Validated embedding endpoint
app/api/answer/route.ts      Validated answer endpoint
lib/pdf.ts                   PDF extraction and file limits
lib/chunks.ts                Page-aware overlapping passages
lib/embeddings.ts            Local multilingual embedding inference
lib/model-cache.ts           Exact-byte model asset cache for Node.js
lib/answers.ts               Grounding instructions, request and source validation
lib/bedrock.ts               Server-side Bedrock Converse integration
lib/retrieval.ts             Cosine ranking and duplicate suppression
tests/retrieval.test.ts      Chunking and retrieval tests
scripts/                    Worker setup and semantic smoke test
```

## Limitations and planned work

Scanned documents require OCR, which is not supported. Complex columns and tables may produce imperfect text order. Semantic search can return irrelevant passages, and the application does not currently infer whether the answer is absent. Large documents take longer to index.

Planned work includes live Bedrock evaluation, retrieval improvements, S3 document storage, authentication and deployment.

## References

- [Transformers.js documentation](https://huggingface.co/docs/transformers.js)
- [Embedding model](https://huggingface.co/Xenova/multilingual-e5-small)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [Amazon Bedrock JavaScript examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html)
