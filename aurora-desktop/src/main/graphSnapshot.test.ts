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
