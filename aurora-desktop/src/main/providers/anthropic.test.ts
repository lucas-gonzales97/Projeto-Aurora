import { describe, it, expect, vi, beforeEach } from "vitest";

const streamMock = { on: vi.fn(), finalMessage: vi.fn() };
const messagesStreamMock = vi.fn(() => streamMock);

vi.mock("@anthropic-ai/sdk", () => ({
  // precisa ser function, não arrow — o provider chama `new Anthropic(...)`
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { stream: messagesStreamMock } };
  }),
}));

const { AnthropicProvider } = await import("./anthropic.js");

describe("AnthropicProvider", () => {
  beforeEach(() => {
    messagesStreamMock.mockClear();
    streamMock.on.mockReset();
    streamMock.finalMessage.mockReset();
  });

  it("wires onDelta to the SDK's 'text' stream event and resolves finalMessage text", async () => {
    const deltas: string[] = [];
    streamMock.on.mockImplementation((event: string, cb: (delta: string) => void) => {
      if (event === "text") {
        cb("Ol");
        cb("á");
      }
      return streamMock;
    });
    streamMock.finalMessage.mockResolvedValue({ content: [{ type: "text", text: "Olá" }] });

    const provider = new AnthropicProvider();
    const result = await provider.sendMessage({
      apiKey: "sk-ant-test",
      model: "claude-sonnet-5",
      system: "seja breve",
      messages: [{ role: "user", content: [{ type: "text", text: "oi" }] }],
      onDelta: (buf) => deltas.push(buf),
    });

    expect(result.text).toBe("Olá");
    expect(deltas).toEqual(["Ol", "Olá"]);
    expect(messagesStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-5", system: "seja breve" })
    );
  });

  it("converts image content blocks to Anthropic's base64 source shape", async () => {
    streamMock.on.mockReturnValue(streamMock);
    streamMock.finalMessage.mockResolvedValue({ content: [{ type: "text", text: "" }] });
    const provider = new AnthropicProvider();
    await provider.sendMessage({
      apiKey: "sk-ant-test",
      model: "claude-sonnet-5",
      system: "",
      messages: [{ role: "user", content: [{ type: "image", mediaType: "image/png", base64: "AAAA" }] }],
    });
    const callArgs = messagesStreamMock.mock.calls[0][0];
    expect(callArgs.messages[0].content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AAAA" },
    });
  });

  it("listModels returns a static list including the current default model", async () => {
    const provider = new AnthropicProvider();
    const models = await provider.listModels("sk-ant-test");
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.id)).toContain("claude-sonnet-5");
  });

  it("validateKey reports invalid when the SDK call throws", async () => {
    streamMock.on.mockReturnValue(streamMock);
    streamMock.finalMessage.mockRejectedValue(new Error("401 authentication_error"));
    const provider = new AnthropicProvider();
    const result = await provider.validateKey("sk-bad");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/authentication/i);
  });

  it("validateKey reports valid when the SDK call succeeds", async () => {
    streamMock.on.mockReturnValue(streamMock);
    streamMock.finalMessage.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const provider = new AnthropicProvider();
    const result = await provider.validateKey("sk-ant-test");
    expect(result.valid).toBe(true);
  });
});
