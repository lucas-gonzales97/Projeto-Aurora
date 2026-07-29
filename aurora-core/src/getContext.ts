// get_context plataforma-agnóstico (ADR-0016) — a "memória do usuário" do Core.
// Réplica fiel do noesis-mcp/src/tools/getContext.ts, mas sobre um VaultStore
// (não sobre `fs`): mesma saída, mesma ordenação, mesmo gate de relevância.
// É o que permite o Android rodar o MESMO retrieval sobre SQLite local.

import type { CoreNote, VaultStore } from "./ports.js";
import { scoreNote, extractTitle, tripleScore, DEFAULT_WEIGHTS, type RetrievalWeights } from "./retrieval.js";

export interface GetContextOptions { limit?: number; weights?: RetrievalWeights; now?: Date; }

export interface ContextRelation {
  target: string; kind: string; weight?: number; reason?: string;
  target_type: string | null; target_status: string | null; target_title: string | null;
}
export interface ContextEntity {
  id: string | null; path: string; title: string;
  relevance: number; text_relevance: number;
  scoring: { relevance_norm: number; recency: number; importance: number };
  frontmatter: Record<string, any>; relations: ContextRelation[];
}

export function getContext(store: VaultStore, intent: string, opts: GetContextOptions = {}): { intent: string; entities: ContextEntity[] } {
  const limit = opts.limit ?? 5;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const now = opts.now ?? new Date();
  const notes = store.listNotes();

  const index = new Map<string, CoreNote>();
  for (const n of notes) if (n.id) index.set(n.id, n);

  // Passo 1: relevância textual com gate (score > 0) — recência/importância
  // nunca trazem pra superfície nota que não casou nada com a intenção.
  const textScored: { note: CoreNote; score: number }[] = [];
  let maxTextScore = 0;
  for (const note of notes) {
    const score = scoreNote(note, intent);
    if (score > 0) { textScored.push({ note, score }); if (score > maxTextScore) maxTextScore = score; }
  }

  // Passo 2: score triplo, ordenar, cortar.
  const scored = textScored.map(({ note, score }) => ({ note, textScore: score, triple: tripleScore(note, score, maxTextScore, weights, now) }));
  scored.sort((a, b) => b.triple.final - a.triple.final);

  const entities = scored.slice(0, limit).map(({ note, textScore, triple }) => {
    const relations: ContextRelation[] = Array.isArray(note.data.relations)
      ? note.data.relations.map((r: any) => {
          const t = index.get(r.target);
          return {
            target: r.target, kind: r.kind, weight: r.weight, reason: r.reason,
            target_type: t?.data?.type ?? null, target_status: t?.data?.status ?? null,
            target_title: t ? extractTitle(t.body) : null,
          };
        })
      : [];
    const { relations: _omit, ...frontmatter } = note.data;
    return {
      id: note.data?.id ?? null, path: note.path, title: extractTitle(note.body),
      relevance: Number(triple.final.toFixed(4)), text_relevance: textScore,
      scoring: {
        relevance_norm: Number(triple.relevance_norm.toFixed(4)),
        recency: Number(triple.recency.toFixed(4)),
        importance: Number(triple.importance.toFixed(4)),
      },
      frontmatter, relations,
    };
  });
  return { intent, entities };
}
