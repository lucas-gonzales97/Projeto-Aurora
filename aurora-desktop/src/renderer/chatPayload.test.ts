import { describe, it, expect } from "vitest";
import { buildModelMessages, type HistoryMessage } from "./chatPayload";

const img = (n: string) => ({ mediaType: "image/png", base64: `base64-${n}` });

function imagesOf(content: Array<{ type: string }>) {
  return content.filter((p) => p.type === "image");
}

describe("buildModelMessages — imagens", () => {
  it("REGRESSÃO (bug 27/07): imagem de turno antigo não viaja no request novo", () => {
    // Cenário real: usuário anexou imagem, o modelo sem visão devolveu 404, ele
    // reenviou só texto — e continuava falhando porque a imagem antiga ia junto.
    const history: HistoryMessage[] = [
      { role: "user", text: "olha isso", images: [img("antiga")] },
      { role: "assistant", text: "não consigo ver imagem" },
      { role: "user", text: "nao tem mais imagem ai chapa" },
    ];
    const out = buildModelMessages(history);
    expect(imagesOf(out[0].content)).toHaveLength(0);
    expect(imagesOf(out[2].content)).toHaveLength(0);
    expect(out.every((m) => imagesOf(m.content).length === 0)).toBe(true);
  });

  it("o turno atual carrega a imagem normalmente", () => {
    const out = buildModelMessages([
      { role: "assistant", text: "oi" },
      { role: "user", text: "e essa?", images: [img("nova")] },
    ]);
    expect(imagesOf(out[1].content)).toHaveLength(1);
    expect(out[1].content).toContainEqual({ type: "image", mediaType: "image/png", base64: "base64-nova" });
  });

  it("múltiplas imagens no turno atual são preservadas", () => {
    const out = buildModelMessages([{ role: "user", text: "duas", images: [img("a"), img("b")] }]);
    expect(imagesOf(out[0].content)).toHaveLength(2);
  });

  it("imagem sem texto continua válida (só o anexo)", () => {
    const out = buildModelMessages([{ role: "user", text: "", images: [img("só")] }]);
    expect(out[0].content).toEqual([{ type: "image", mediaType: "image/png", base64: "base64-só" }]);
  });
});

describe("buildModelMessages — texto e estrutura", () => {
  it("preserva papéis e ordem", () => {
    const out = buildModelMessages([
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
      { role: "user", text: "c" },
    ]);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(out.map((m) => (m.content[0] as { text: string }).text)).toEqual(["a", "b", "c"]);
  });

  it("nunca devolve content vazio (provedor rejeita)", () => {
    const out = buildModelMessages([{ role: "user", text: "" }]);
    expect(out[0].content).toEqual([{ type: "text", text: "" }]);
  });

  it("aplica a marca temporal do chatTime no texto", () => {
    const out = buildModelMessages([{ role: "user", text: "oi", ts: "2026-07-24T17:16:00Z" }]);
    expect((out[0].content[0] as { text: string }).text).toBe("[24/07/2026 14:16] oi");
  });

  it("marca temporal e imagem coexistem no mesmo turno", () => {
    const out = buildModelMessages([{ role: "user", text: "veja", ts: "2026-07-24T17:16:00Z", images: [img("x")] }]);
    expect((out[0].content[0] as { text: string }).text).toBe("[24/07/2026 14:16] veja");
    expect(imagesOf(out[0].content)).toHaveLength(1);
  });

  it("histórico vazio devolve lista vazia", () => {
    expect(buildModelMessages([])).toEqual([]);
  });
});
