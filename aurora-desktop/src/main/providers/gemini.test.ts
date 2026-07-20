import { describe, it, expect, vi, afterEach } from "vitest";
import { sseResponse, jsonResponse } from "./testUtils.js";
import { GeminiProvider } from "./gemini.js";

describe("GeminiProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends contents/parts shape with system as systemInstruction and api key as header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"oi"}]}}]}\n\n']));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider();
    const result = await provider.sendMessage({
      apiKey: "AIza-test",
      model: "gemini-3-flash",
      system: "seja breve",
      messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }],
    });

    expect(result.text).toBe("oi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-3-flash:streamGenerateContent");
    expect(init.headers["x-goog-api-key"]).toBe("AIza-test");
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe("seja breve");
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "oi" }] });
  });

  it("maps assistant role to 'model' for Gemini's contents shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(["data: {}\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider();
    await provider.sendMessage({
      apiKey: "AIza-test",
      model: "gemini-3-flash",
      system: "",
      messages: [
        { role: "user", content: [{ type: "text", text: "oi" }] },
        { role: "assistant", content: [{ type: "text", text: "olá" }] },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[1].role).toBe("model");
  });

  it("converts image content blocks to inline_data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(["data: {}\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider();
    await provider.sendMessage({
      apiKey: "AIza-test",
      model: "gemini-3-flash",
      system: "",
      messages: [{ role: "user", content: [{ type: "image", mediaType: "image/png", base64: "AAAA" }] }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: "image/png", data: "AAAA" } });
  });

  it("validateKey reports invalid on a 400 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "API key not valid" } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider();
    const result = await provider.validateKey("bad-key");
    expect(result.valid).toBe(false);
  });

  it("validateKey reports valid on a 200 response from listModels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: "models/gemini-3-flash" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider();
    const result = await provider.validateKey("AIza-test");
    expect(result.valid).toBe(true);
  });
});
