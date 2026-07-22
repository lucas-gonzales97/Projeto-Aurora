import { describe, it, expect, vi, afterEach } from "vitest";
import { sseResponse, jsonResponse } from "./testUtils.js";
import { OpenAICompatibleProvider } from "./openAICompatible.js";
import type { OpenAICompatibleConfig } from "./types.js";

const config: OpenAICompatibleConfig = {
  id: "groq",
  label: "Groq",
  baseURL: "https://api.groq.com/openai/v1",
  requiresApiKey: true,
  defaultModels: [{ id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" }],
};

describe("OpenAICompatibleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams deltas and resolves the accumulated text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Ol"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"á"}}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleProvider(config);
    const deltas: string[] = [];
    const result = await provider.sendMessage({
      apiKey: "sk-test",
      model: "llama-3.3-70b-versatile",
      system: "seja breve",
      messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }],
      onDelta: (buf) => deltas.push(buf),
    });

    expect(result.text).toBe("Olá");
    expect(deltas).toEqual(["Ol", "Olá"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.messages[0]).toEqual({ role: "system", content: "seja breve" });
    expect(body.messages[1].role).toBe("user");
  });

  it("propagates token usage from the final SSE chunk's usage field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"oi"}}]}\n\n',
        'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":9,"completion_tokens":4}}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    const result = await provider.sendMessage({
      apiKey: "sk-test",
      model: "llama-3.3-70b-versatile",
      system: "",
      messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }],
    });
    expect(result.inputTokens).toBe(9);
    expect(result.outputTokens).toBe(4);
  });

  it("converts image content blocks to the OpenAI image_url shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    await provider.sendMessage({
      apiKey: "sk-test",
      model: "llama-3.3-70b-versatile",
      system: "",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "o que é isso?" },
            { type: "image", mediaType: "image/png", base64: "AAAA" },
          ],
        },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = body.messages.find((m: any) => m.role === "user");
    expect(Array.isArray(userMsg.content)).toBe(true);
    const imageBlock = userMsg.content.find((b: any) => b.type === "image_url");
    expect(imageBlock.image_url.url).toBe("data:image/png;base64,AAAA");
  });

  it("does not send an Authorization header when the provider does not require a key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const ollama = new OpenAICompatibleProvider({
      ...config,
      id: "ollama",
      requiresApiKey: false,
      baseURL: "http://localhost:11434/v1",
    });
    await ollama.sendMessage({ apiKey: "", model: "llama3.3", system: "", messages: [] });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("lists models from the /models endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ id: "llama-3.3-70b-versatile" }, { id: "mixtral-8x7b" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    const models = await provider.listModels("sk-test");
    expect(models.map((m) => m.id)).toEqual(["llama-3.3-70b-versatile", "mixtral-8x7b"]);
  });

  it("falls back to defaultModels when /models fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    const models = await provider.listModels("sk-test");
    expect(models).toEqual(config.defaultModels);
  });

  it("validateKey returns valid:true on a 200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    const result = await provider.validateKey("sk-test");
    expect(result.valid).toBe(true);
  });

  it("validateKey returns valid:false with an error on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "invalid api key" } }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(config);
    const result = await provider.validateKey("sk-bad");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid api key/i);
  });
});
