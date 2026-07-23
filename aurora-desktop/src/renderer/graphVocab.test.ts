import { describe, expect, it } from "vitest";
import { cleanLabel, kindLabel, typeInfo } from "./graphVocab";

// Casos reais do vault (decisão de produto: nó tem que ler bem pra leigo).
describe("cleanLabel", () => {
  it("tira o prefixo de tipo, ficando com o nome (Goal — X)", () => {
    expect(cleanLabel("Goal — Emprego CLT remoto (≥ piso da categoria)", "goal-emprego-clt-remoto")).toBe("Emprego CLT remoto");
    expect(cleanLabel("Skill — Desenvolvimento de software", "skill-desenvolvimento-software")).toBe("Desenvolvimento de software");
  });

  it("prefixo ADR também sai", () => {
    expect(cleanLabel("ADR-0009 — Aurora crua: vault como fonte ÚNICA de contexto", "adr-0009"))
      .toBe("Aurora crua: vault como fonte ÚNICA de contexto");
  });

  it("journal vira 'Diário de DD/MM/AAAA'", () => {
    expect(cleanLabel("Journal — 2026-07-23", "journal-2026-07-23-sessao-fable")).toBe("Diário de 23/07/2026");
    expect(cleanLabel("Journal — 2026-07-17", "journal-2026-07-17-noesis-mcp")).toBe("Diário de 17/07/2026");
  });

  it("'Nome — subtítulo' (subtítulo minúsculo) fica com o NOME antes do travessão", () => {
    expect(cleanLabel("Rotina Nutricional — compartimento coordenador", "rotina-nutricional")).toBe("Rotina Nutricional");
  });

  it("tira crases e fica com o nome quando o depois é fraco (uma palavra)", () => {
    expect(cleanLabel("Extensão do USER-MODEL — `strategy` (estratégias como hipóteses)", "extensao-user-model-strategies"))
      .toBe("Extensão do USER-MODEL");
  });

  it("'Nome próprio — descrição' (depois começa maiúsculo) fica com a descrição", () => {
    expect(cleanLabel("AURORA — Persona Cognitiva do NOESIS", "aurora-persona")).toBe("Persona Cognitiva do NOESIS");
  });

  it("sem título, de-sluga o id", () => {
    expect(cleanLabel("", "motor-epistemico")).toBe("Motor Epistemico");
    expect(cleanLabel(null, "design-tokens")).toBe("Design Tokens");
  });

  it("não corta parêntese quando sobraria só uma palavra", () => {
    // "Grafo (visualização)" -> noParen "Grafo" tem 1 palavra -> mantém o parêntese
    expect(cleanLabel("Grafo (visualização)", "x")).toBe("Grafo (visualização)");
  });
});

describe("typeInfo / kindLabel", () => {
  it("tipo conhecido devolve rótulo amigável", () => {
    expect(typeInfo("goal").label).toBe("Meta");
    expect(typeInfo("decision").label).toBe("Decisão");
  });
  it("tipo desconhecido/nulo cai no genérico", () => {
    expect(typeInfo("xpto").label).toBe("Nó");
    expect(typeInfo(null).label).toBe("Nó");
  });
  it("kind vira frase legível", () => {
    expect(kindLabel("depende_de")).toBe("depende de");
    expect(kindLabel("sustenta")).toBe("sustenta");
    expect(kindLabel("kind_novo_qualquer")).toBe("kind novo qualquer");
  });
});
