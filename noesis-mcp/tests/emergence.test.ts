import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { emergenceRatio } from "../src/emergence.js";

describe("emergenceRatio", () => {
  test("vault vazio: total 0, ratio null", () => {
    const r = emergenceRatio([]);
    assert.deepEqual(r, { total: 0, emerged: 0, inserted: 0, ratio: null });
  });

  test("só notas inseridas (nenhuma reflexão): ratio 0", () => {
    const r = emergenceRatio([
      { frontmatter: { origin: "declared" } },
      { frontmatter: { origin: "declared" } },
      { frontmatter: {} }, // types sem campo origin (project, decision...) contam como inseridos
    ]);
    assert.equal(r.total, 3);
    assert.equal(r.emerged, 0);
    assert.equal(r.inserted, 3);
    assert.equal(r.ratio, 0);
  });

  test("mistura: conta origin=reflection como emergido, resto como inserido", () => {
    const r = emergenceRatio([
      { frontmatter: { origin: "declared" } },
      { frontmatter: { origin: "reflection" } },
      { frontmatter: { origin: "reflection" } },
      { frontmatter: { origin: "session" } },
    ]);
    assert.equal(r.total, 4);
    assert.equal(r.emerged, 2);
    assert.equal(r.inserted, 2);
    assert.equal(r.ratio, 1); // 2/2 — razão 1:1 nesse instante do vault
  });

  test("só reflexões (sem inserido): ratio null, não divide por zero", () => {
    const r = emergenceRatio([
      { frontmatter: { origin: "reflection" } },
      { frontmatter: { origin: "reflection" } },
    ]);
    assert.equal(r.inserted, 0);
    assert.equal(r.ratio, null);
  });

  test("frontmatter ausente é tratado como inserido (não quebra)", () => {
    const r = emergenceRatio([{}, { frontmatter: undefined }]);
    assert.equal(r.total, 2);
    assert.equal(r.emerged, 0);
    assert.equal(r.inserted, 2);
  });
});
