import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  LLMProvider,
  ModelInfo,
  SendMessageParams,
  SendMessageResult,
  ValidateKeyResult,
} from "./types.js";

const DEFAULT_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-fable-5", label: "Claude Fable 5" },
];

// Continua sobre @anthropic-ai/sdk (já em produção, já testado) em vez de
// fetch cru como os demais — ver decisions/ADR-0006-multi-provider-llm.md §2.
export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic Claude";
  readonly requiresApiKey = true;

  private toAnthropicContent(m: ChatMessage) {
    return m.content.map((b) =>
      b.type === "image"
        ? { type: "image" as const, source: { type: "base64" as const, media_type: (b.mediaType ?? "image/png") as any, data: b.base64 ?? "" } }
        : { type: "text" as const, text: b.text ?? "" }
    );
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const client = new Anthropic({ apiKey: params.apiKey });
    const stream = client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens ?? 1000,
      system: params.system,
      messages: params.messages.map((m) => ({ role: m.role, content: this.toAnthropicContent(m) })),
    });

    let text = "";
    stream.on("text", (delta: string) => {
      text += delta;
      params.onDelta?.(text);
    });

    const finalMessage = await stream.finalMessage();
    const finalText = finalMessage.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return { text: finalText || text };
  }

  async listModels(): Promise<ModelInfo[]> {
    return DEFAULT_MODELS;
  }

  async validateKey(apiKey: string): Promise<ValidateKeyResult> {
    try {
      await this.sendMessage({
        apiKey,
        model: "claude-haiku-4-5-20251001",
        system: "",
        messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
        maxTokens: 1,
      });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
