import { describe, it, expect, vi, afterEach } from "vitest";
import { synthesizeSpeech, validateAzureSpeechConfig } from "./azureSpeech.js";

function audioResponse(bytes: number[], status = 200): Response {
  return new Response(new Uint8Array(bytes).buffer, { status });
}

describe("synthesizeSpeech", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts SSML with the Francisca neural voice to the regional endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(audioResponse([1, 2, 3, 4]));
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech({ text: "oi", subscriptionKey: "sk-test", region: "brazilsouth" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("sk-test");
    expect(init.headers["Content-Type"]).toBe("application/ssml+xml");
    expect(init.headers["X-Microsoft-OutputFormat"]).toBe("audio-16khz-128kbitrate-mono-mp3");
    expect(init.body).toContain("pt-BR-FranciscaNeural");
    expect(init.body).toContain(">oi<");
  });

  it("escapes SSML-special characters in the text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(audioResponse([1]));
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech({ text: `Tom & "Jerry" <3 café's`, subscriptionKey: "sk-test", region: "brazilsouth" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toContain("Tom &amp; &quot;Jerry&quot; &lt;3 café&apos;s");
    expect(init.body).not.toContain("<3 café");
  });

  it("resolves with base64-encoded audio and the mp3 mime type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(audioResponse([0x49, 0x44, 0x33]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeSpeech({ text: "oi", subscriptionKey: "sk-test", region: "brazilsouth" });

    expect(result.mimeType).toBe("audio/mpeg");
    expect(Buffer.from(result.audioBase64, "base64")).toEqual(Buffer.from([0x49, 0x44, 0x33]));
  });

  it("throws with the status code and body on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid subscription key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      synthesizeSpeech({ text: "oi", subscriptionKey: "sk-bad", region: "brazilsouth" })
    ).rejects.toThrow(/401.*invalid subscription key/);
  });
});

describe("validateAzureSpeechConfig", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns valid:true when a minimal synthesis succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(audioResponse([1])));
    const result = await validateAzureSpeechConfig("sk-test", "brazilsouth");
    expect(result.valid).toBe(true);
  });

  it("returns valid:false with the error when synthesis fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("access denied", { status: 401 })));
    const result = await validateAzureSpeechConfig("sk-bad", "brazilsouth");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/401/);
  });
});
