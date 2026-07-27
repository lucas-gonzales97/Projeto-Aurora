import { describe, expect, it } from "vitest";
import {
  REFLECTION_THRESHOLD,
  countUserMessages,
  shouldReflect,
  buildReflectionPrompt,
  parseReflectionResponse,
  buildReflectionNoteId,
  buildReflectionNoteBody,
  buildReflectionRelations,
  formatMessageTime,
  type ReflectionMessage,
} from "./reflection";

describe("countUserMessages / shouldReflect", () => {
  it("conta só mensagens de role user", () => {
    const msgs: ReflectionMessage[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    expect(countUserMessages(msgs)).toBe(2);
  });

  it("abaixo do limiar: não reflete", () => {
    expect(shouldReflect(REFLECTION_THRESHOLD - 1)).toBe(false);
  });

  it("no limiar ou acima: reflete", () => {
    expect(shouldReflect(REFLECTION_THRESHOLD)).toBe(true);
    expect(shouldReflect(REFLECTION_THRESHOLD + 5)).toBe(true);
  });

  it("limiar customizado é respeitado", () => {
    expect(shouldReflect(2, 5)).toBe(false);
    expect(shouldReflect(5, 5)).toBe(true);
  });
});

describe("buildReflectionPrompt", () => {
  it("inclui transcrição com papéis traduzidos e lista de entidades", () => {
    const prompt = buildReflectionPrompt(
      [
        { role: "user", content: "oi" },
        { role: "assistant", content: "olá" },
      ],
      [{ id: "goal-x", title: "Meta X" }],
    );
    expect(prompt).toContain("Usuário: oi");
    expect(prompt).toContain("Aurora: olá");
    expect(prompt).toContain("goal-x — Meta X");
  });

  it("sem mensagens/entidades: usa placeholders honestos em vez de listas vazias silenciosas", () => {
    const prompt = buildReflectionPrompt([], []);
    expect(prompt).toContain("sessão sem mensagens");
    expect(prompt).toContain("nenhuma entidade do vault foi ativada");
  });
});

describe("parseReflectionResponse", () => {
  it("SKIP explícito: skip=true", () => {
    expect(parseReflectionResponse("SKIP")).toEqual({ skip: true });
    expect(parseReflectionResponse("  skip  ")).toEqual({ skip: true });
  });

  it("resposta vazia: skip=true (nunca cria nota malformada)", () => {
    expect(parseReflectionResponse("")).toEqual({ skip: true });
    expect(parseReflectionResponse("   ")).toEqual({ skip: true });
  });

  it("fora do formato esperado (sem REFLEXÃO:): skip=true", () => {
    expect(parseReflectionResponse("desculpe, não sei sintetizar isso.").skip).toBe(true);
  });

  it("formato válido: extrai corpo e confiança", () => {
    const r = parseReflectionResponse("CONFIANÇA: 0.4\nREFLEXÃO: usuário evita falar de finanças quando o assunto é trabalho.");
    expect(r.skip).toBe(false);
    expect(r.body).toBe("usuário evita falar de finanças quando o assunto é trabalho.");
    expect(r.confidence).toBe(0.4);
  });

  it("confiança fora de [0.1, 0.6]: satura no limite (Art. VIII-2 — nunca alta confiança sem confirmação)", () => {
    expect(parseReflectionResponse("CONFIANÇA: 0.95\nREFLEXÃO: x").confidence).toBe(0.6);
    expect(parseReflectionResponse("CONFIANÇA: 0\nREFLEXÃO: x").confidence).toBe(0.1);
  });

  it("confiança ausente ou não numérica: cai no default conservador 0.3", () => {
    expect(parseReflectionResponse("REFLEXÃO: x").confidence).toBe(0.3);
    expect(parseReflectionResponse("CONFIANÇA: nada\nREFLEXÃO: x").confidence).toBe(0.3);
  });

  it("só a primeira linha da reflexão é usada, mesmo se o LLM continuar escrevendo", () => {
    const r = parseReflectionResponse("REFLEXÃO: primeira frase.\nsegunda linha deveria ser ignorada");
    expect(r.body).toBe("primeira frase.");
  });
});

describe("buildReflectionNoteId", () => {
  it("é slug kebab-case válido a partir de uuid + data", () => {
    const id = buildReflectionNoteId("a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c", "2026-07-24");
    expect(id).toBe("pattern-reflexao-2026-07-24-a1b2c3d4");
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("sessionId sem chars alfanuméricos suficientes não quebra (fallback)", () => {
    const id = buildReflectionNoteId("---", "2026-07-24");
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("buildReflectionNoteBody", () => {
  it("inclui o texto, a contagem de entidades e a confiança", () => {
    const body = buildReflectionNoteBody("padrão X observado.", 0.4, 3);
    expect(body).toContain("padrão X observado.");
    expect(body).toContain("3 entidade(s)");
    expect(body).toContain("Confiança inicial: 0.4");
  });
});

describe("buildReflectionRelations", () => {
  it("uma relação emerge_de por entidade ativada", () => {
    const rels = buildReflectionRelations([{ id: "goal-x" }, { id: "habit-y" }]);
    expect(rels).toHaveLength(2);
    expect(rels[0]).toEqual({ target: "goal-x", kind: "emerge_de", reason: expect.any(String) });
  });

  it("lista vazia: nenhuma relação", () => {
    expect(buildReflectionRelations([])).toEqual([]);
  });
});

describe("formatMessageTime (temporalidade)", () => {
  it("formata no fuso do usuário, não em UTC", () => {
    expect(formatMessageTime("2026-07-24T17:16:00Z")).toBe("24/07/2026 14:16");
  });

  it("é vazio pra ts ausente ou inválido (nunca quebra a transcrição)", () => {
    expect(formatMessageTime(undefined)).toBe("");
    expect(formatMessageTime("nao-e-data")).toBe("");
  });
});

describe("buildReflectionPrompt com timestamps", () => {
  it("data cada linha da transcrição", () => {
    const out = buildReflectionPrompt(
      [
        { role: "user", content: "oi", ts: "2026-07-24T17:16:00Z" },
        { role: "assistant", content: "olá", ts: "2026-07-24T17:16:30Z" },
      ],
      [],
    );
    expect(out).toContain("[24/07/2026 14:16] Usuário: oi");
    expect(out).toContain("[24/07/2026 14:16] Aurora: olá");
  });

  it("mensagem sem ts continua na transcrição, só sem carimbo", () => {
    const out = buildReflectionPrompt([{ role: "user", content: "sem data" }], []);
    expect(out).toContain("Usuário: sem data");
    expect(out).not.toContain("[]");
  });
});
