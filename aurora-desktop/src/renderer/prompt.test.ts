import { describe, expect, it } from "vitest";
import {
  AURORA_SYSTEM,
  ONBOARDING_SYSTEM,
  buildChatSystemPrompt,
  buildOnboardingSystemPrompt,
  nowContext,
} from "./prompt";

// ADR-0009 (Aurora crua): o system prompt estático NÃO pode conter nenhum dado
// de usuário. Estes marcadores vêm do bloco "CONTEXTO DO USUÁRIO" que existia
// hardcoded no AURORA_SYSTEM (goals/hábitos/perfil reais do dono do repo) e
// que causava confabulação com vault vazio + vazamento de privacidade em
// instalação de terceiro (provado na validação do ADR-0008). Se qualquer um
// reaparecer no prompt estático, este teste tem que quebrar.
const USER_DATA_MARKERS = [
  "CONTEXTO DO USUÁRIO",
  "CLT",
  "refrigeração",
  "Mercado Livre",
  "Tiny",
  "Olist",
  "Mercado Pago",
  "64kg",
  "72-73",
  "80kg",
  "Fatec",
  "TCC",
  "fobia social",
  "creatina",
  "hipercalórico",
  "2,5L",
  "SMD",
  "BGA",
  "PS4",
  "ESP32",
  "emprego-clt-remoto",
  "saude-fisica",
  "concluir-faculdade",
  "reconexao-social",
  "hidratacao",
  "suplementacao",
];

describe("AURORA_SYSTEM (prompt estático)", () => {
  it("não contém nenhum marcador de dado real de usuário", () => {
    for (const marker of USER_DATA_MARKERS) {
      expect(AURORA_SYSTEM).not.toContain(marker);
    }
  });

  it("instrui explicitamente a não inventar fatos sobre o usuário", () => {
    expect(AURORA_SYSTEM).toContain("NÃO inventa fatos sobre o usuário");
    expect(AURORA_SYSTEM).toContain("CONTEXTO RECUPERADO DO VAULT");
  });
});

describe("ONBOARDING_SYSTEM", () => {
  it("também não contém dado real de usuário", () => {
    for (const marker of USER_DATA_MARKERS) {
      expect(ONBOARDING_SYSTEM).not.toContain(marker);
    }
  });
});

describe("buildChatSystemPrompt", () => {
  it("com vault vazio, o prompt inteiro não contém nenhum dado de usuário (anti-confabulação)", () => {
    const prompt = buildChatSystemPrompt("como está meu objetivo de emprego?", []);
    for (const marker of USER_DATA_MARKERS) {
      expect(prompt).not.toContain(marker);
    }
    expect(prompt).not.toContain("CONTEXTO RECUPERADO DO VAULT (get_context");
  });

  it("entities null/undefined comporta-se como vault vazio", () => {
    expect(buildChatSystemPrompt("oi", null)).not.toContain("CONTEXTO RECUPERADO DO VAULT (get_context");
    expect(buildChatSystemPrompt("oi", undefined)).not.toContain("CONTEXTO RECUPERADO DO VAULT (get_context");
  });

  it("com entities do vault, anexa exatamente o bloco de contexto recuperado", () => {
    const entities = [{ id: "goal-exemplo", type: "goal", score: 12 }];
    const prompt = buildChatSystemPrompt("emprego", entities);
    expect(prompt).toContain('CONTEXTO RECUPERADO DO VAULT (get_context, intent="emprego")');
    expect(prompt).toContain('"id": "goal-exemplo"');
  });

  it("todo conteúdo de usuário no prompt vem só do parâmetro entities (fonte única = vault)", () => {
    const withCtx = buildChatSystemPrompt("x", [{ id: "nota-unica-xyz" }], new Date("2026-07-23T12:00:00Z"));
    const without = buildChatSystemPrompt("x", [], new Date("2026-07-23T12:00:00Z"));
    // A diferença entre os dois prompts é exatamente o bloco do vault — nada mais.
    expect(withCtx.startsWith(without)).toBe(true);
    expect(withCtx.slice(without.length)).toContain("nota-unica-xyz");
  });
});

describe("nowContext (consciência temporal)", () => {
  it("carimba data/hora em America/Sao_Paulo e o timestamp ISO", () => {
    const fixed = new Date("2026-07-23T15:30:00Z");
    const ctx = nowContext(fixed);
    expect(ctx).toContain("America/Sao_Paulo");
    expect(ctx).toContain("2026-07-23T15:30:00.000Z");
    expect(ctx).toContain("julho");
  });

  it("entra no início do prompt do chat e do onboarding", () => {
    expect(buildChatSystemPrompt("oi", []).startsWith("CONTEXTO TEMPORAL")).toBe(true);
    expect(buildOnboardingSystemPrompt().startsWith("CONTEXTO TEMPORAL")).toBe(true);
  });
});
