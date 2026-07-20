// Contrato comum de provedor de LLM — ver decisions/ADR-0006-multi-provider-llm.md.
// Só tipos/constantes aqui (fase 2, arquitetura); implementação vem na fase 3
// depois dos testes (TDD) — ver providers/*.test.ts.

export interface ChatContentBlock {
  type: "text" | "image";
  text?: string;
  mediaType?: string;
  base64?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: ChatContentBlock[];
}

export interface SendMessageParams {
  apiKey: string; // "" para provedores que não usam chave (ex.: Ollama)
  model: string;
  system: string;
  messages: ChatMessage[];
  onDelta?: (delta: string) => void;
  maxTokens?: number; // usado por validateKey para minimizar custo do ping (ex.: Anthropic)
}

export interface SendMessageResult {
  text: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
}

export interface ValidateKeyResult {
  valid: boolean;
  error?: string;
}

export interface LLMProvider {
  id: string;
  label: string;
  requiresApiKey: boolean;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
  validateKey(apiKey: string): Promise<ValidateKeyResult>;
}

// Config de cada instância do provider genérico compatível com OpenAI
// (OpenAI, Groq, Mistral, OpenRouter, DeepSeek, Ollama — ver ADR-0006 §2).
export interface OpenAICompatibleConfig {
  id: string;
  label: string;
  baseURL: string;
  requiresApiKey: boolean;
  defaultModels: ModelInfo[]; // fallback caso /models falhe ou não exista
}

// Os tipos globais de fetch/Response colidem entre @types/node e os tipos do
// Electron neste projeto (Response.json() resolve para `{}` em vez de
// `unknown`) — este helper isola o `any` num único lugar em vez de espalhar
// `as any` pelos providers.
export async function readJson(res: Response): Promise<any> {
  return res.json();
}

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "groq"
  | "mistral"
  | "openrouter"
  | "ollama"
  | "deepseek";
