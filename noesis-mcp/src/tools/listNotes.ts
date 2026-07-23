import { z } from "zod";
import { listNoteFiles, readNoteFile } from "../vault.js";
import { extractTitle } from "../search.js";

// list_notes: enumera notas do vault por type/status SEM pontuação de
// relevância (diferente de search_notes, que exige um query e descarta
// score <= 0). É o que a aba Painel do Aurora Desktop precisa pra listar
// "todos os meus goals / hábitos" sem inventar um texto de busca. Ordena
// por created desc (mais recente primeiro) pra dar uma ordem estável e útil.
export const listNotesSchema = {
  type: z.string().optional().describe("filtra por type (goal, habit, project, value, skill, ...)"),
  status: z.string().optional().describe("filtra por status (active, paused, done, ...)"),
  dir: z.string().optional().describe("filtra por prefixo de caminho relativo, ex.: 'user-model/goals'"),
  limit: z.number().int().positive().max(200).optional().describe("máximo de resultados (padrão 100)"),
};

export interface ListNotesInput {
  type?: string;
  status?: string;
  dir?: string;
  limit?: number;
}

export interface ListNotesEntry {
  id: string | null;
  path: string;
  type: string | null;
  status: string | null;
  title: string | null;
  frontmatter: Record<string, any>;
}

export function listNotes(input: ListNotesInput) {
  const limit = input.limit ?? 100;
  const dirPrefix = input.dir ? input.dir.replace(/\\/g, "/").replace(/\/+$/, "") + "/" : null;
  const entries: ListNotesEntry[] = [];

  for (const absPath of listNoteFiles()) {
    let note;
    try {
      note = readNoteFile(absPath);
    } catch {
      continue;
    }
    if (input.type && note.data?.type !== input.type) continue;
    if (input.status && note.data?.status !== input.status) continue;
    if (dirPrefix && !note.relPath.startsWith(dirPrefix)) continue;

    const { relations: _omit, ...frontmatter } = note.data ?? {};
    entries.push({
      id: note.data?.id ?? null,
      path: note.relPath,
      type: note.data?.type ?? null,
      status: note.data?.status ?? null,
      title: extractTitle(note.body),
      frontmatter,
    });
  }

  entries.sort((a, b) => String(b.frontmatter.created ?? "").localeCompare(String(a.frontmatter.created ?? "")));
  return { count: entries.length, results: entries.slice(0, limit) };
}
