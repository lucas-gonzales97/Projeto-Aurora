import { test } from "node:test";
import assert from "node:assert/strict";
import { AURORA_SYSTEM, ONBOARDING_SYSTEM, nowContext, buildChatSystemPrompt, buildOnboardingSystemPrompt } from "../dist/index.js";

test("persona não vaza dado de usuário (ADR-0009 — Aurora crua)", () => {
  // Marcadores de dados reais do vault do dono do repo NÃO podem aparecer na
  // base estática — a única fonte de contexto é o get_context em runtime.
  for (const marker of ["Lucas", "freelance", "CLT", "faculdade", "eletrônica"]) {
    assert.ok(!AURORA_SYSTEM.includes(marker), `AURORA_SYSTEM não deve conter "${marker}"`);
  }
});

test("nowContext usa America/Sao_Paulo e traz o ISO", () => {
  const s = nowContext(new Date("2026-07-24T17:16:00Z"));
  assert.match(s, /America\/Sao_Paulo/);
  assert.match(s, /14:16/); // 17:16Z = 14:16 em SP
  assert.match(s, /2026-07-24T17:16:00\.000Z/);
});

test("buildChatSystemPrompt sem entities = só temporal + persona", () => {
  const p = buildChatSystemPrompt("oi", null);
  assert.ok(p.includes(AURORA_SYSTEM));
  // A persona MENCIONA "CONTEXTO RECUPERADO DO VAULT"; o marcador do bloco de
  // fato injetado é "(get_context, intent=", que só existe quando há entities.
  assert.ok(!p.includes("(get_context, intent="));
});

test("buildChatSystemPrompt com entities injeta o bloco de contexto", () => {
  const p = buildChatSystemPrompt("freelance", [{ id: "goal-x", title: "Meta X" }]);
  assert.ok(p.includes("CONTEXTO RECUPERADO DO VAULT"));
  assert.ok(p.includes("goal-x"));
  assert.ok(p.includes('intent="freelance"'));
});

test("onboarding substitui inteiramente a persona base", () => {
  const p = buildOnboardingSystemPrompt();
  assert.ok(p.includes(ONBOARDING_SYSTEM));
  assert.ok(!p.includes(AURORA_SYSTEM));
});
