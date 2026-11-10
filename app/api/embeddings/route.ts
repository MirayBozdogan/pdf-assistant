import { embedTexts } from "../../../lib/embeddings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 40_000) return Response.json({ error: "İstek boyutu sınırı aşıldı." }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400, headers });
  }
  const texts = body && typeof body === "object" && "texts" in body ? body.texts : undefined;
  const kind = body && typeof body === "object" && "kind" in body ? body.kind : undefined;
  if ((kind !== "query" && kind !== "passage") || !Array.isArray(texts) || !texts.length || texts.length > 8 ||
    !texts.every((text) => typeof text === "string" && text.trim().length > 0 && text.length <= 500)) {
    return Response.json({ error: "Her istekte en fazla 8 metin ve metin başına 500 karakter gönderilebilir." }, { status: 400, headers });
  }
  try {
    return Response.json({ embeddings: await embedTexts(texts, kind) }, { headers });
  } catch (error) {
    console.error("Embedding inference failed:", error instanceof Error ? error.stack : error);
    return Response.json({ error: "Arama modeli yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin." }, { status: 503, headers });
  }
}
