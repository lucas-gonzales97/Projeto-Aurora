import { describe, it, expect } from "vitest";
import { PROVIDER_REGISTRY, getProvider } from "./index.js";

const expectedIds = ["anthropic", "openai", "gemini", "groq", "mistral", "openrouter", "ollama", "deepseek"];

describe("provider registry", () => {
  it("registers exactly the 8 supported providers", () => {
    expect(Object.keys(PROVIDER_REGISTRY).sort()).toEqual([...expectedIds].sort());
  });

  it("marks ollama as the only provider that does not require an api key", () => {
    for (const id of expectedIds) {
      expect(PROVIDER_REGISTRY[id].requiresApiKey).toBe(id !== "ollama");
    }
  });

  it("getProvider returns an LLMProvider whose id matches the registry key", () => {
    for (const id of expectedIds) {
      const provider = getProvider(id);
      expect(provider.id).toBe(id);
      expect(typeof provider.sendMessage).toBe("function");
      expect(typeof provider.listModels).toBe("function");
      expect(typeof provider.validateKey).toBe("function");
    }
  });

  it("throws a clear error for an unknown provider id", () => {
    expect(() => getProvider("nonexistent")).toThrow(/nonexistent/);
  });
});
