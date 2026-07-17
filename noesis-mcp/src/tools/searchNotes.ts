import { z } from "zod";
import { listNoteFiles, readNoteFile } from "../vault.js";
import { scoreNote, toHit } from "../search.js";

export const searchNotesSchema = {
  query: z.string().describe("texto livre buscado no id, frontmatter e corpo das notas"),
  type: z.string().optional().describe("filtra por type (goal, habit, project, hypothesis, skill, value, ...)"),
  status: z.string().optional().describe("filtra por status (active, paused, done, ...)"),
  limit: z.number().int().positive().max(50).optional().describe("máximo de resultados (padrão 10)"),
};

export interface SearchNotesInput {
  query: string;
  type?: string;
  status?: string;
  limit?: number;
}

export function searchNotes(input: SearchNotesInput) {
  const limit = input.limit ?? 10;
  const hits = [];
  for (const absPath of listNoteFiles()) {
    let note;
    try {
      note = readNoteFile(absPath);
    } catch {
      continue;
    }
    if (input.type && note.data?.type !== input.type) continue;
    if (input.status && note.data?.status !== input.status) continue;
    const score = scoreNote(note, input.query);
    if (score <= 0) continue;
    hits.push(toHit(note, score, input.query));
  }
  hits.sort((a, b) => b.score - a.score);
  return { query: input.query, count: hits.length, results: hits.slice(0, limit) };
}
