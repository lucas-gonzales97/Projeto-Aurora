import { z } from "zod";
import { buildIndex, listNoteFiles, readNoteFile } from "../vault.js";
import { scoreNote, extractTitle } from "../search.js";

export const getContextSchema = {
  intent: z.string().describe("a intenção/pergunta atual, em linguagem natural — ex.: 'Lucas quer falar sobre freelance'"),
  limit: z.number().int().positive().max(20).optional().describe("máximo de entidades a expandir (padrão 5)"),
};

export interface GetContextInput {
  intent: string;
  limit?: number;
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
  const index = buildIndex();

  const scored = [];
  for (const absPath of listNoteFiles()) {
    let note;
    try {
      note = readNoteFile(absPath);
    } catch {
      continue;
    }
    const score = scoreNote(note, input.intent);
    if (score > 0) scored.push({ note, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  const entities = top.map(({ note, score }) => {
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
      relevance: score,
      frontmatter,
      relations,
    };
  });

  return { intent: input.intent, entities };
}
