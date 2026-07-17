import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { safeResolve, toRelPath, writeNoteFile, runValidator, todayISO, VaultPathError } from "../vault.js";
import { getEntityType, knownTypes } from "../ontology.js";

export const createNoteSchema = {
  type: z.string().describe(`type da entidade, um de: ${"goal | habit | hypothesis | project | decision | identity | foundation | value | skill | conflict | meta"}`),
  id: z.string().describe("id da nota; vira o nome do arquivo (<id>.md) — deve ser um slug (kebab-case)"),
  dir: z
    .string()
    .describe("diretório relativo ao vault onde criar a nota, ex.: 'user-model/goals', 'user-model/values', 'decisions'"),
  status: z.string().describe("status inicial (os valores permitidos dependem do type — ver ontology/ontology.yaml)"),
  created: z.string().optional().describe("data ISO (YYYY-MM-DD); padrão: hoje"),
  fields: z.record(z.string(), z.any()).optional().describe("campos extra exigidos pelo schema do type (ex.: horizon/origin/confidence/success_criteria/review_cycle para goal)"),
  relations: z
    .array(
      z.object({
        target: z.string(),
        kind: z.string(),
        weight: z.number().min(0).max(1).optional(),
        reason: z.string().optional(),
        evidence: z.array(z.string()).optional(),
      })
    )
    .optional()
    .describe("relações iniciais desta nota com outras entidades do grafo"),
  body: z.string().describe("conteúdo Markdown da nota, sem o frontmatter"),
};

export interface CreateNoteInput {
  type: string;
  id: string;
  dir: string;
  status: string;
  created?: string;
  fields?: Record<string, any>;
  relations?: Array<{ target: string; kind: string; weight?: number; reason?: string; evidence?: string[] }>;
  body: string;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createNote(input: CreateNoteInput) {
  if (!SLUG_RE.test(input.id)) {
    throw new VaultPathError(`id '${input.id}' não é um slug kebab-case válido (ex.: 'goal-minha-meta')`);
  }

  const entitySpec = getEntityType(input.type);
  const warnings: string[] = [];
  if (!entitySpec) {
    warnings.push(`type '${input.type}' não está em ontology/ontology.yaml (tipos conhecidos: ${knownTypes().join(", ")}) — pode falhar na validação.`);
  } else {
    const commonFields = new Set(["id", "type", "status", "created"]);
    for (const field of entitySpec.requiredFields) {
      if (commonFields.has(field)) continue; // sempre fornecidos por parâmetros dedicados
      if (input.fields?.[field] === undefined) {
        warnings.push(`campo obrigatório para type '${input.type}' ausente em 'fields': ${field}`);
      }
    }
  }

  const relPath = path.join(input.dir, `${input.id}.md`);
  const absPath = safeResolve(relPath);
  if (fs.existsSync(absPath)) {
    throw new VaultPathError(`Já existe uma nota em '${toRelPath(absPath)}' — create_note não sobrescreve.`);
  }

  const data: Record<string, any> = {
    id: input.id,
    type: input.type,
    ...(input.fields ?? {}),
    status: input.status,
    created: input.created ?? todayISO(),
  };
  if (input.relations && input.relations.length > 0) {
    data.relations = input.relations;
  }

  writeNoteFile(absPath, data, input.body);

  const validation = await runValidator([absPath]);
  if (!validation.ok) {
    fs.unlinkSync(absPath);
    throw new VaultPathError(`Validação falhou (nota não criada):\n${validation.output}`);
  }

  return {
    path: toRelPath(absPath),
    validation: "ok",
    warnings,
  };
}
