import { AnswerInputError, parseAnswerRequest } from "../../../lib/answers";
import { answerErrorResponse, generateAnswer } from "../../../lib/bedrock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return Response.json({ error: "İstek boyutu sınırı aşıldı." }, { status: 413, headers });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new AnswerInputError("Geçersiz istek."); }
    const input = parseAnswerRequest(body);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
    return Response.json(await generateAnswer(input, signal), { headers });
  } catch (error) {
    if (error instanceof AnswerInputError) return Response.json({ error: error.message }, { status: 400, headers });
    // Server-side diagnostics only; the question and excerpts are never logged.
    const meta = (error as { $metadata?: { httpStatusCode?: number; requestId?: string } } | null)?.$metadata;
    console.error("Answer generation failed:", error instanceof Error ? `${error.name}: ${error.message}` : error,
      meta ? { httpStatus: meta.httpStatusCode, requestId: meta.requestId } : "");
    const response = answerErrorResponse(error);
    return Response.json({ error: response.error }, { status: response.status, headers });
  }
}
