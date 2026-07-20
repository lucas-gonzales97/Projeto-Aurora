import { readJson } from "./types.js";
import type {
  ChatMessage,
  LLMProvider,
  ModelInfo,
  SendMessageParams,
  SendMessageResult,
  ValidateKeyResult,
} from "./types.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Gemini fala um dialeto diferente do formato OpenAI (contents/parts, não
// messages/content) — ver decisions/ADR-0006-multi-provider-llm.md §2 e
// decisions/research-llm-providers.md.
export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  readonly requiresApiKey = true;

  private toGeminiContents(messages: ChatMessage[]) {
    return messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.content.map((b) =>
        b.type === "image"
          ? { inline_data: { mime_type: b.mediaType ?? "image/png", data: b.base64 ?? "" } }
          : { text: b.text ?? "" }
      ),
    }));
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const url = `${BASE_URL}/models/${params.model}:streamGenerateContent?alt=sse`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": params.apiKey },
      body: JSON.stringify({
        ...(params.system ? { systemInstruction: { parts: [{ text: params.system }] } } : {}),
        contents: this.toGeminiContents(params.messages),
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await safeReadText(res);
      throw new Error(`Gemini: falha na chamada (${res.status}) ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        try {
          const parsed = JSON.parse(payload);
          const delta: string = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (delta) {
            text += delta;
            params.onDelta?.(text);
          }
        } catch {
          // linha SSE incompleta — ignora, o próximo chunk completa
        }
      }
    }

    return { text };
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${BASE_URL}/models`, { headers: { "x-goog-api-key": apiKey ?? "" } });
      if (!res.ok) return DEFAULT_MODELS;
      const data = await readJson(res);
      const list = Array.isArray(data?.models) ? data.models : [];
      if (list.length === 0) return DEFAULT_MODELS;
      return list.map((m: { name: string }) => {
        const id = m.name.replace(/^models\//, "");
        return { id, label: id };
      });
    } catch {
      return DEFAULT_MODELS;
    }
  }

  async validateKey(apiKey: string): Promise<ValidateKeyResult> {
    try {
      const res = await fetch(`${BASE_URL}/models`, { headers: { "x-goog-api-key": apiKey } });
      if (res.ok) return { valid: true };
      const data = await readJson(res).catch(() => null);
      return { valid: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

const DEFAULT_MODELS: ModelInfo[] = [
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
