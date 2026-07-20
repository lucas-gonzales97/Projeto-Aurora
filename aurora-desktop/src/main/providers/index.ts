import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAICompatibleProvider } from "./openAICompatible.js";
import type { LLMProvider, OpenAICompatibleConfig } from "./types.js";

// Config de cada instância OpenAI-compatível — ver
// decisions/ADR-0006-multi-provider-llm.md §2/§3. Adicionar um provedor novo
// desse dialeto é uma entrada aqui, não uma classe nova.
const OPENAI_COMPATIBLE_CONFIGS: OpenAICompatibleConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    requiresApiKey: true,
    defaultModels: [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    defaultModels: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    defaultModels: [
      { id: "mistral-large-latest", label: "Mistral Large" },
      { id: "mistral-small-latest", label: "Mistral Small" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    defaultModels: [
      { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (free)" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    requiresApiKey: false,
    defaultModels: [],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    requiresApiKey: true,
    defaultModels: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    ],
  },
];

function buildRegistry(): Record<string, LLMProvider> {
  const registry: Record<string, LLMProvider> = {
    anthropic: new AnthropicProvider(),
    gemini: new GeminiProvider(),
  };
  for (const config of OPENAI_COMPATIBLE_CONFIGS) {
    registry[config.id] = new OpenAICompatibleProvider(config);
  }
  return registry;
}

export const PROVIDER_REGISTRY: Record<string, LLMProvider> = buildRegistry();

export function getProvider(id: string): LLMProvider {
  const provider = PROVIDER_REGISTRY[id];
  if (!provider) {
    throw new Error(`Provedor desconhecido: '${id}'. Provedores disponíveis: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`);
  }
  return provider;
}

export * from "./types.js";
