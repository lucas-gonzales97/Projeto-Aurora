import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// O VAULT_ROOT é resolvido no load de vault.ts — a env var precisa existir
// ANTES de qualquer import do código sob teste. Vault temporário, descartável.
const TMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), "noesis-test-vault-"));
process.env.NOESIS_VAULT_ROOT = TMP_VAULT;

const { recencyScore, importanceScore, noteTimestamp, tripleScore, DEFAULT_WEIGHTS, LEGACY_WEIGHTS, RECENCY_HALF_LIFE_DAYS, DEFAULT_IMPORTANCE } =
  await import("../src/retrieval.js");
const { getContext } = await import("../src/tools/getContext.js");
const { scoreNote } = await import("../src/search.js");
const { readNoteFile } = await import("../src/vault.js");
const { validateFrontmatterFiles } = await import("../src/validateFrontmatter.js");

const NOW = new Date("2026-07-23T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function writeNote(rel: string, frontmatter: string, body: string): string {
  const abs = path.join(TMP_VAULT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${frontmatter}\n---\n\n${body}\n`, "utf-8");
  return abs;
}

before(() => {
  // Vault de teste: 3 notas sobre "trabalho", com idades e importâncias distintas.
  writeNote(
    "user-model/goals/goal-antigo-relevante.md",
    ["id: goal-antigo-relevante", "type: goal", "status: active", "created: 2026-01-01", "horizon: mid", "origin: declared", "confidence: 0.8", "progress: 0", "success_criteria: trabalho conseguido", "review_cycle: weekly"].join("\n"),
    "# Goal antigo\n\ntrabalho trabalho trabalho trabalho trabalho emprego carreira",
  );
  writeNote(
    "user-model/goals/goal-recente-importante.md",
    ["id: goal-recente-importante", "type: goal", "status: active", "created: 2026-07-22", "horizon: mid", "origin: declared", "confidence: 0.8", "progress: 0", "success_criteria: trabalho novo", "review_cycle: weekly", "importance: 9"].join("\n"),
    "# Goal recente\n\ntrabalho emprego",
  );
  writeNote(
    "user-model/goals/goal-sem-importancia.md",
    ["id: goal-sem-importancia", "type: goal", "status: active", "created: 2026-07-10", "horizon: mid", "origin: declared", "confidence: 0.8", "progress: 0", "success_criteria: x", "review_cycle: weekly"].join("\n"),
    "# Goal neutro\n\ntrabalho",
  );
  // Nota irrelevante pra intent de trabalho, mas nova e "importantíssima":
  // o gate de relevância textual não pode deixá-la aparecer.
  writeNote(
    "user-model/goals/goal-irrelevante-novo.md",
    ["id: goal-irrelevante-novo", "type: goal", "status: active", "created: 2026-07-23", "horizon: mid", "origin: declared", "confidence: 0.8", "progress: 0", "success_criteria: y", "review_cycle: weekly", "importance: 10"].join("\n"),
    "# Jardinagem\n\nregar plantas suculentas",
  );
});

after(() => {
  fs.rmSync(TMP_VAULT, { recursive: true, force: true });
});

describe("recencyScore (decaimento exponencial)", () => {
  test("agora = 1", () => {
    assert.equal(recencyScore(NOW, NOW), 1);
  });
  test("uma meia-vida atrás = 0.5", () => {
    const halfLifeAgo = new Date(NOW.getTime() - RECENCY_HALF_LIFE_DAYS * DAY);
    assert.ok(Math.abs(recencyScore(halfLifeAgo, NOW) - 0.5) < 1e-9);
  });
  test("duas meias-vidas atrás = 0.25", () => {
    const twoAgo = new Date(NOW.getTime() - 2 * RECENCY_HALF_LIFE_DAYS * DAY);
    assert.ok(Math.abs(recencyScore(twoAgo, NOW) - 0.25) < 1e-9);
  });
  test("timestamp no futuro não passa de 1 (clamp)", () => {
    assert.equal(recencyScore(new Date(NOW.getTime() + 5 * DAY), NOW), 1);
  });
});

describe("importanceScore", () => {
  test(`nota sem importance usa default ${DEFAULT_IMPORTANCE} → 0.5`, () => {
    const note = readNoteFile(path.join(TMP_VAULT, "user-model/goals/goal-sem-importancia.md"));
    assert.equal(importanceScore(note), DEFAULT_IMPORTANCE / 10);
  });
  test("importance: 9 → 0.9", () => {
    const note = readNoteFile(path.join(TMP_VAULT, "user-model/goals/goal-recente-importante.md"));
    assert.equal(importanceScore(note), 0.9);
  });
  test("valor fora da faixa é clampado, não explode", () => {
    assert.equal(importanceScore({ absPath: "x", relPath: "x", body: "", data: { importance: 42 } } as any), 1);
    assert.equal(importanceScore({ absPath: "x", relPath: "x", body: "", data: { importance: -3 } } as any), 0);
  });
});

describe("noteTimestamp", () => {
  test("updated vence created", () => {
    const note = { absPath: "x", relPath: "x", body: "", data: { created: "2026-01-01", updated: "2026-07-20" } } as any;
    assert.equal(noteTimestamp(note).toISOString().slice(0, 10), "2026-07-20");
  });
  test("sem updated, usa created", () => {
    const note = { absPath: "x", relPath: "x", body: "", data: { created: "2026-01-01" } } as any;
    assert.equal(noteTimestamp(note).toISOString().slice(0, 10), "2026-01-01");
  });
  test("sem nenhum campo, cai pro mtime do arquivo", () => {
    const fake = new Date("2026-05-05T00:00:00Z");
    const note = { absPath: "x", relPath: "x", body: "", data: {} } as any;
    assert.equal(noteTimestamp(note, () => fake).getTime(), fake.getTime());
  });
});

// Nota dos testes abaixo: a intent NÃO pode conter palavras de uma letra
// ("e", "o"...) — o tokenizador do scoreNote antigo não tem stopwords, então
// "e" casa com o frontmatter de QUALQUER nota (descoberto ao escrever este
// teste; limitação herdada, registrada no ADR-0010 como pendência).
describe("getContext com pesos zerados (regressão pro comportamento antigo)", () => {
  test("LEGACY_WEIGHTS reproduz exatamente a ordenação do score textual puro", () => {
    const intent = "trabalho emprego";
    const legacy = getContext({ intent, weights: LEGACY_WEIGHTS, now: NOW });

    // Ordenação independente sobre TODAS as notas do vault de teste,
    // calculada direto com o scoreNote antigo (gate: score > 0).
    const oldOrder = ["goal-antigo-relevante", "goal-recente-importante", "goal-sem-importancia", "goal-irrelevante-novo"]
      .map((id) => {
        const note = readNoteFile(path.join(TMP_VAULT, `user-model/goals/${id}.md`));
        return { id, score: scoreNote(note, intent) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.id);

    assert.deepEqual(legacy.entities.map((e: any) => e.id), oldOrder);
  });
});

describe("getContext com pesos novos (retrieval triplo)", () => {
  test("nota recente e importante sobe acima da antiga de relevância maior", () => {
    const intent = "trabalho emprego";
    const legacy = getContext({ intent, weights: LEGACY_WEIGHTS, now: NOW });
    const triple = getContext({ intent, weights: DEFAULT_WEIGHTS, now: NOW });
    // No modo antigo o goal-antigo (body cheio de repetição) vence;
    // no triplo, recência+importância do goal-recente-importante o superam.
    assert.equal(legacy.entities[0].id, "goal-antigo-relevante");
    assert.equal(triple.entities[0].id, "goal-recente-importante");
  });

  test("gate de relevância: nota sem match textual NUNCA aparece, por mais nova/importante que seja", () => {
    const out = getContext({ intent: "trabalho emprego", weights: DEFAULT_WEIGHTS, now: NOW });
    assert.ok(!out.entities.some((e: any) => e.id === "goal-irrelevante-novo"));
  });

  test("expõe os componentes do score (scoring) e o score textual cru (text_relevance)", () => {
    const out = getContext({ intent: "trabalho", weights: DEFAULT_WEIGHTS, now: NOW });
    const e = out.entities[0];
    assert.ok(typeof e.text_relevance === "number");
    for (const k of ["relevance_norm", "recency", "importance"]) {
      const v = (e.scoring as any)[k];
      assert.ok(v >= 0 && v <= 1, `${k}=${v} fora de [0,1]`);
    }
  });
});

describe("tripleScore (componentes)", () => {
  test("pesos default combinam soma ponderada corretamente", () => {
    const note = { absPath: "x", relPath: "x", body: "", data: { created: "2026-07-23", importance: 10 } } as any;
    const s = tripleScore(note, 10, 10, { rel: 1, rec: 0.5, imp: 0.5 }, NOW);
    // rel_norm=1, recency≈1 (mesmo dia), imp=1 → final ≈ 1 + 0.5 + 0.5
    assert.ok(Math.abs(s.final - 2) < 0.01);
  });
});

describe("validador: campo importance (sincronia com scripts/validate_frontmatter.py)", () => {
  function noteWith(importanceLine: string | null): string {
    const lines = ["id: goal-valida-imp", "type: goal", "status: active", "created: 2026-07-23", "horizon: mid", "origin: declared", "confidence: 0.8", "progress: 0", "success_criteria: x", "review_cycle: weekly"];
    if (importanceLine) lines.push(importanceLine);
    return writeNote("user-model/goals/goal-valida-imp.md", lines.join("\n"), "# t\n\ncorpo");
  }

  test("ausente: aceita (campo opcional — notas existentes não quebram)", () => {
    assert.equal(validateFrontmatterFiles([noteWith(null)]).ok, true);
  });
  test("válido (0-10): aceita", () => {
    assert.equal(validateFrontmatterFiles([noteWith("importance: 7")]).ok, true);
  });
  test("fora de [0,10]: rejeita", () => {
    const r = validateFrontmatterFiles([noteWith("importance: 15")]);
    assert.equal(r.ok, false);
    assert.match(r.output, /importance=15 fora de \[0,10\]/);
  });
  test("não-numérico: rejeita", () => {
    const r = validateFrontmatterFiles([noteWith("importance: alta")]);
    assert.equal(r.ok, false);
    assert.match(r.output, /não é numérico/);
  });
});
