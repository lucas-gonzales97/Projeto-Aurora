import { describe, expect, it } from "vitest";
import { buildGraphSnapshot, type GraphSourceNote } from "./graphSnapshot";

function note(id: string | null, relations: GraphSourceNote["relations"] = [], extra: Partial<GraphSourceNote> = {}): GraphSourceNote {
  return {
    id,
    path: `user-model/${id ?? "sem-id"}.md`,
    type: "goal",
    status: "active",
    title: id ? `Título de ${id}` : null,
    relations,
    ...extra,
  };
}

describe("buildGraphSnapshot", () => {
  it("fidelidade: nº de nós == notas com id; nº de arestas == relações com target existente", () => {
    const notes = [
      note("a", [{ target: "b", kind: "sustenta", weight: 0.8 }, { target: "c", kind: "depende_de" }]),
      note("b", [{ target: "a", kind: "sustentado_por" }]),
      note("c"),
    ];
    const g = buildGraphSnapshot(notes);
    expect(g.nodes).toHaveLength(3);
    expect(g.edges).toHaveLength(3);
    expect(g.warnings).toHaveLength(0);
    expect(g.edges[0]).toEqual({ from: "a", to: "b", kind: "sustenta", weight: 0.8 });
    expect(g.edges[1].weight).toBe(0.5); // weight ausente -> default
  });

  it("robustez (critério do plano): relação pra id inexistente é ignorada com warning, sem quebrar", () => {
    const g = buildGraphSnapshot([note("a", [{ target: "fantasma", kind: "serve_a" }])]);
    expect(g.nodes).toHaveLength(1);
    expect(g.edges).toHaveLength(0);
    expect(g.warnings).toHaveLength(1);
    expect(g.warnings[0]).toContain("fantasma");
  });

  it("nota sem id não vira nó nem origem de aresta", () => {
    const g = buildGraphSnapshot([note(null, [{ target: "a", kind: "serve_a" }]), note("a")]);
    expect(g.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(g.edges).toHaveLength(0);
  });

  it("id duplicado: primeiro vence, sem nó duplicado", () => {
    const g = buildGraphSnapshot([note("a"), note("a")]);
    expect(g.nodes).toHaveLength(1);
  });

  it("label cai pro id quando não há título", () => {
    const g = buildGraphSnapshot([note("a", [], { title: null })]);
    expect(g.nodes[0].label).toBe("a");
  });
});

describe("nós emergidos (ADR-0013)", () => {
  const base = { path: "p.md", type: "hypothesis", status: "active", title: "T", relations: [] };

  it("marca como emergida a nota com origin: reflection", () => {
    const s = buildGraphSnapshot([{ ...base, id: "refl", frontmatter: { origin: "reflection" } }]);
    expect(s.nodes[0].emerged).toBe(true);
  });

  it("nota inserida por humano não é emergida", () => {
    const s = buildGraphSnapshot([{ ...base, id: "decl", frontmatter: { origin: "declared" } }]);
    expect(s.nodes[0].emerged).toBe(false);
  });

  it("nota sem frontmatter/origin não é emergida (nunca infere)", () => {
    const semFm = buildGraphSnapshot([{ ...base, id: "a" }]);
    const semOrigin = buildGraphSnapshot([{ ...base, id: "b", frontmatter: {} }]);
    expect(semFm.nodes[0].emerged).toBe(false);
    expect(semOrigin.nodes[0].emerged).toBe(false);
  });

  it("separa emergidas de inseridas no mesmo snapshot", () => {
    const s = buildGraphSnapshot([
      { ...base, id: "r1", frontmatter: { origin: "reflection" } },
      { ...base, id: "h1", frontmatter: { origin: "declared" } },
      { ...base, id: "r2", frontmatter: { origin: "reflection" } },
    ]);
    expect(s.nodes.filter((n) => n.emerged).map((n) => n.id)).toEqual(["r1", "r2"]);
  });
});
