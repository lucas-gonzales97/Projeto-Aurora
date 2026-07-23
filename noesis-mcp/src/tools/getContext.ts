import { z } from "zod";
import { buildIndex, listNoteFiles, readNoteFile } from "../vault.js";
import { scoreNote, extractTitle } from "../search.js";
import { DEFAULT_WEIGHTS, tripleScore, type RetrievalWeights } from "../retrieval.js";

export const getContextSchema = {
  intent: z.string().describe("a intenção/pergunta atual, em linguagem natural — ex.: 'Lucas quer falar sobre freelance'"),
  limit: z.number().int().positive().max(20).optional().describe("máximo de entidades a expandir (padrão 5)"),
};

export interface GetContextInput {
  intent: string;
  limit?: number;
  /**
   * Override dos pesos do retrieval triplo (ADR-0010). NÃO exposto no schema
   * MCP — existe pra bancada A/B (bench/) e testes compararem modos; o app
   * sempre usa DEFAULT_WEIGHTS.
   */
  weights?: RetrievalWeights;
  /** Relógio injetável pra testes/bancada determinísticos. */
  now?: Date;
}

interface RelationOut {
  target: string;
  kind: string;
  weight?: number;
  reason?: string;
  target_type: string | null;
  target_status: string | null;
  target_title: string | null;
}

export function getContext(input: GetContextInput) {
  const limit = input.limit ?? 5;
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const now = input.now ?? new Date();
  const index = buildIndex();

  // Passo 1: relevância textual (gate: score > 0 — recência/importância nunca
  // trazem pra superfície nota que não casou nada com a intenção).
  const textScored = [];
  let maxTextScore = 0;
  for (const absPath of listNoteFiles()) {
    let note;
    try {
      note = readNoteFile(absPath);
    } catch {
      continue;
    }
    const score = scoreNote(note, input.intent);
    if (score > 0) {
      textScored.push({ note, score });
      if (score > maxTextScore) maxTextScore = score;
    }
  }

  // Passo 2: score triplo (ADR-0010) — relevância normalizada × pesos + recência + importância.
  const scored = textScored.map(({ note, score }) => ({
    note,
    textScore: score,
    triple: tripleScore(note, score, maxTextScore, weights, now),
  }));
  scored.sort((a, b) => b.triple.final - a.triple.final);
  const top = scored.slice(0, limit);

  const entities = top.map(({ note, textScore, triple }) => {
    const relations: RelationOut[] = Array.isArray(note.data.relations)
      ? note.data.relations.map((r: any) => {
          const targetNote = index.get(r.target);
          return {
            target: r.target,
            kind: r.kind,
            weight: r.weight,
            reason: r.reason,
            target_type: targetNote?.data?.type ?? null,
            target_status: targetNote?.data?.status ?? null,
            target_title: targetNote ? extractTitle(targetNote.body) : null,
          };
        })
      : [];

    const { relations: _omit, ...frontmatter } = note.data;
    return {
      id: note.data?.id ?? null,
      path: note.relPath,
      title: extractTitle(note.body),
      // Score combinado (ordena a lista). text_relevance preserva o score
      // textual cru pré-ADR-0010; scoring expõe os componentes pra bancada,
      // telemetria e futura visualização ("por que essa nota acendeu").
      relevance: Number(triple.final.toFixed(4)),
      text_relevance: textScore,
      scoring: {
        relevance_norm: Number(triple.relevance_norm.toFixed(4)),
        recency: Number(triple.recency.toFixed(4)),
        importance: Number(triple.importance.toFixed(4)),
      },
      frontmatter,
      relations,
    };
  });

  return { intent: input.intent, entities };
}
