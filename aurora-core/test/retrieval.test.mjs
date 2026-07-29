import { test } from "node:test";
import assert from "node:assert/strict";
import { getContext, tripleScore, scoreNote, noteTimestamp, DEFAULT_WEIGHTS, LEGACY_WEIGHTS } from "../dist/index.js";

// VaultStore fake em memória — prova que o Core roda sobre QUALQUER store
// (Android/SQLite no futuro), não só sobre fs.
function store(notes) { return { listNotes: () => notes }; }
const note = (id, body, data = {}) => ({ id, path: `${id}.md`, body, data: { id, ...data }, mtime: new Date("2026-07-01T00:00:00Z") });

const NOW = new Date("2026-07-24T12:00:00Z");

test("gate de relevância: nota que não casa a intenção não entra", () => {
  const s = store([note("goal-freelance", "# Renda extra via freelance"), note("goal-sono", "# Dormir melhor")]);
  const { entities } = getContext(s, "freelance", { now: NOW });
  assert.equal(entities.length, 1);
  assert.equal(entities[0].id, "goal-freelance");
});

test("ordena por score triplo e respeita o limit", () => {
  const s = store([
    note("a", "# freelance freelance freelance"),
    note("b", "# freelance"),
    note("c", "# nada a ver"),
  ]);
  const { entities } = getContext(s, "freelance", { now: NOW, limit: 2 });
  assert.deepEqual(entities.map((e) => e.id), ["a", "b"]);
  assert.equal(entities.length, 2);
});

test("expõe componentes de scoring (transparência do ADR-0010)", () => {
  const { entities } = getContext(store([note("g", "# freelance")]), "freelance", { now: NOW });
  const sc = entities[0].scoring;
  assert.ok(typeof sc.relevance_norm === "number" && typeof sc.recency === "number" && typeof sc.importance === "number");
});

test("resolve relações (target_title vem do corpo do alvo)", () => {
  const s = store([
    note("goal-x", "# Meta X", { relations: [{ target: "goal-y", kind: "depende_de" }] }),
    note("goal-y", "# Meta Y dependência"),
  ]);
  const { entities } = getContext(s, "Meta X", { now: NOW });
  const rel = entities.find((e) => e.id === "goal-x").relations[0];
  assert.equal(rel.target, "goal-y");
  assert.equal(rel.target_title, "Meta Y dependência");
});

test("LEGACY_WEIGHTS (rec=imp=0) reproduz ordenação só-texto (regressão ADR-0010)", () => {
  const s = store([note("a", "# freelance freelance"), note("b", "# freelance")]);
  const legacy = getContext(s, "freelance", { now: NOW, weights: LEGACY_WEIGHTS }).entities.map((e) => e.id);
  assert.deepEqual(legacy, ["a", "b"]); // mais matches = mais alto, sem recência/importância mexendo
});

test("importance do frontmatter empurra o score", () => {
  const base = note("a", "# freelance");
  const important = { ...note("b", "# freelance"), data: { id: "b", importance: 10 } };
  const { entities } = getContext(store([base, important]), "freelance", { now: NOW });
  // mesmo texto; a de importance 10 deve vir primeiro
  assert.equal(entities[0].id, "b");
});

test("noteTimestamp: updated > created > mtime", () => {
  const n = note("x", "# x", { updated: "2026-07-20", created: "2026-01-01" });
  assert.equal(noteTimestamp(n).toISOString(), "2026-07-20T00:00:00.000Z");
  const semDatas = note("y", "# y");
  assert.equal(noteTimestamp(semDatas).getTime(), new Date("2026-07-01T00:00:00Z").getTime());
});
