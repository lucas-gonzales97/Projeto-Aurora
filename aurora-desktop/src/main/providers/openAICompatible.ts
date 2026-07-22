import { readJson } from "./types.js";
import type {
  ChatMessage,
  LLMProvider,
  ModelInfo,
  OpenAICompatibleConfig,
  SendMessageParams,
  SendMessageResult,
  ValidateKeyResult,
} from "./types.js";

// Provider genérico para os provedores que falam (quase) o mesmo dialeto da
// OpenAI: OpenAI, Groq, Mistral, OpenRouter, DeepSeek, Ollama — ver
// decisions/ADR-0006-multi-provider-llm.md §2. Uma instância por provedor,
// configurada via OpenAICompatibleConfig; nenhuma classe nova por provedor.
export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  get id() { return this.config.id; }
  get label() { return this.config.label; }
  get requiresApiKey() { return this.config.requiresApiKey; }

  private headers(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.requiresApiKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  private toOpenAIMessages(system: string, messages: ChatMessage[]) {
    const out: unknown[] = [];
    if (system) out.push({ role: "system", content: system });
    for (const m of messages) {
      const hasImage = m.content.some((b) => b.type === "image");
      if (!hasImage) {
        const text = m.content.map((b) => b.text ?? "").join("");
        out.push({ role: m.role, content: text });
        continue;
      }
      out.push({
        role: m.role,
        content: m.content.map((b) =>
          b.type === "image"
            ? { type: "image_url", image_url: { url: `data:${b.mediaType ?? "image/png"};base64,${b.base64 ?? ""}` } }
            : { type: "text", text: b.text ?? "" }
        ),
      });
    }
    return out;
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.headers(params.apiKey),
      body: JSON.stringify({
        model: params.model,
        stream: true,
        // Pede o chunk final de uso (padrão OpenAI, seguido por
        // Groq/Mistral/OpenRouter/DeepSeek). Servidor que não reconhece o
        // campo (ex.: builds mais antigos do Ollama) simplesmente ignora —
        // é JSON solto, não quebra a chamada; só faz inputTokens/outputTokens
        // ficarem undefined nesse caso.
        stream_options: { include_usage: true },
        messages: this.toOpenAIMessages(params.system, params.messages),
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await safeReadText(res);
      throw new Error(`${this.config.label}: falha na chamada (${res.status}) ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

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
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const delta: string = parsed?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            text += delta;
            params.onDelta?.(text);
          }
          if (parsed?.usage) {
            inputTokens = parsed.usage.prompt_tokens;
            outputTokens = parsed.usage.completion_tokens;
          }
        } catch {
          // linha SSE incompleta/não-JSON — ignora, o próximo chunk completa o buffer
        }
      }
    }

    return { text, inputTokens, outputTokens };
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.config.baseURL}/models`, {
        headers: this.headers(apiKey ?? ""),
      });
      if (!res.ok) return this.config.defaultModels;
      const data = await readJson(res);
      const list = Array.isArray(data?.data) ? data.data : [];
      if (list.length === 0) return this.config.defaultModels;
      return list.map((m: { id: string }) => ({ id: m.id, label: m.id }));
    } catch {
      return this.config.defaultModels;
    }
  }

  async validateKey(apiKey: string): Promise<ValidateKeyResult> {
    try {
      const res = await fetch(`${this.config.baseURL}/models`, { headers: this.headers(apiKey) });
      if (res.ok) return { valid: true };
      const data = await readJson(res).catch(() => null);
      return { valid: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
