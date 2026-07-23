// Montagem do snapshot do grafo (ADR-0012) a partir do list_notes do
// noesis-mcp — deliberadamente NÃO varre o vault por conta própria: a
// definição de "o que é nota" (dirs ignorados etc.) mora num lugar só, o
// noesis-mcp. Função pura, testável sem Electron nem MCP.

export interface GraphSourceNote {
  id: string | null;
  path: string;
  type: string | null;
  status: string | null;
  title: string | null;
  relations: { target: string; kind: string; weight?: number }[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  status: string | null;
  path: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
  weight: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** relações descartadas (target inexistente etc.) — logadas, nunca fatais */
  warnings: string[];
}

export function buildGraphSnapshot(notes: GraphSourceNote[]): GraphSnapshot {
  const nodes: GraphNode[] = [];
  const known = new Set<string>();
  for (const n of notes) {
    // Nota sem id não vira nó (não há como apontar relação pra ela).
    if (!n.id) continue;
    if (known.has(n.id)) continue; // id duplicado: primeiro vence, resto é warning
    known.add(n.id);
    nodes.push({
      id: n.id,
      label: n.title?.trim() || n.id,
      type: n.type ?? "meta",
      status: n.status,
      path: n.path,
    });
  }

  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  for (const n of notes) {
    if (!n.id || !known.has(n.id)) continue;
    for (const r of n.relations) {
      if (!known.has(r.target)) {
        // Robustez (critério do plano): relação pra id inexistente não quebra
        // o grafo — aresta ignorada com warning.
        warnings.push(`relação ignorada: ${n.id} -[${r.kind}]-> ${r.target} (target inexistente)`);
        continue;
      }
      edges.push({ from: n.id, to: r.target, kind: r.kind, weight: r.weight ?? 0.5 });
    }
  }

  return { nodes, edges, warnings };
}
