import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { ANSWER_SYSTEM_PROMPT, answerUserMessage, parseGroundedAnswer, AnswerFormatError, type AnswerRequest } from "./answers.ts";

export class AnswerConfigurationError extends Error {}
export class AnswerProviderError extends Error {}

export async function generateAnswer(input: AnswerRequest, signal?: AbortSignal) {
  const region = process.env.AWS_REGION;
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!region || !modelId) throw new AnswerConfigurationError("Bedrock region and model are not configured.");

  // The SDK resolves AWS credentials on the server; none are sent to the browser.
  const client = new BedrockRuntimeClient({ region, maxAttempts: 1 });
  try {
    const response = await client.send(new ConverseCommand({
      modelId,
      system: [{ text: ANSWER_SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: answerUserMessage(input) }] }],
      inferenceConfig: { maxTokens: 1200, temperature: 0 },
    }), { abortSignal: signal });

    if (response.stopReason !== "end_turn") throw new AnswerProviderError("Incomplete or blocked answer.");
    const text = (response.output?.message?.content ?? []).map((part) => part.text ?? "").join("");
    return parseGroundedAnswer(text, input.passages);
  } finally {
    client.destroy();
  }
}

export function answerErrorResponse(error: unknown): { status: number; error: string } {
  if (error instanceof AnswerConfigurationError) return { status: 503, error: "Cevap üretme şu anda kullanılamıyor. Belge bölümlerini inceleyebilirsiniz." };
  if (error instanceof AnswerFormatError || error instanceof AnswerProviderError) return { status: 502, error: "Kaynağı doğrulanabilen bir cevap oluşturulamadı. Belge bölümlerini inceleyin veya sorunuzu farklı ifade edin." };
  const name = error instanceof Error ? error.name : "";
  if (["AbortError", "TimeoutError"].includes(name)) return { status: 504, error: "Cevap oluşturma zaman aşımına uğradı. Lütfen tekrar deneyin." };
  if (["ThrottlingException", "ServiceQuotaExceededException"].includes(name)) return { status: 429, error: "Cevap servisi şu anda yoğun. Biraz sonra tekrar deneyin." };
  return { status: 503, error: "Cevap servisine erişilemiyor. Lütfen daha sonra tekrar deneyin." };
}
