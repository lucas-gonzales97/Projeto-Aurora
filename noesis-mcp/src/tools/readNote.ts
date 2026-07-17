import { z } from "zod";
import { resolveNote } from "../vault.js";

export const readNoteSchema = {
  id: z.string().optional().describe("id da nota (campo 'id' do frontmatter), ex.: 'goal-emprego-clt-remoto'"),
  path: z
    .string()
    .optional()
    .describe("caminho relativo ao vault, ex.: 'user-model/goals/goal-emprego-clt-remoto.md' (extensão .md opcional)"),
};

export interface ReadNoteInput {
  id?: string;
  path?: string;
}

export function readNote(input: ReadNoteInput) {
  const note = resolveNote(input);
  return {
    path: note.relPath,
    frontmatter: note.data,
    body: note.body,
  };
}
