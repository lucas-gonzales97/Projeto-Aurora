import { z } from "zod";
import { resolveNote, appendRelation, restoreRawFile, runValidator } from "../vault.js";
import { knownRelationKinds } from "../ontology.js";

export const createRelationSchema = {
  source_id: z.string().describe("id da nota de origem (onde a relação será escrita, em 'relations:')"),
  target_id: z.string().describe("id da entidade alvo da relação"),
  kind: z.string().describe("tipo de relação (ver ontology/ontology.yaml relation_kinds — vocabulário aberto, não fechado)"),
  weight: z.number().min(0).max(1).optional().describe("peso da relação, 0-1 (padrão 0.5)"),
  reason: z.string().optional().describe("por que essa relação existe"),
  evidence: z.array(z.string()).optional().describe("ids de eventos/notas que sustentam a relação (padrão: [])"),
};

export interface CreateRelationInput {
  source_id: string;
  target_id: string;
  kind: string;
  weight?: number;
  reason?: string;
  evidence?: string[];
}

export async function createRelation(input: CreateRelationInput) {
  const source = resolveNote({ id: input.source_id });

  const warnings: string[] = [];
  if (!knownRelationKinds().includes(input.kind)) {
    warnings.push(
      `kind '${input.kind}' não está no vocabulário atual de ontology/ontology.yaml (aberto por design — daemon pode propor novos, mas confira se não é typo de um kind existente).`
    );
  }

  const relation = {
    target: input.target_id,
    kind: input.kind,
    weight: input.weight ?? 0.5,
    reason: input.reason ?? "",
    evidence: input.evidence ?? [],
  };

  const originalRaw = appendRelation(source.absPath, relation);

  const validation = await runValidator([source.absPath]);
  if (!validation.ok) {
    restoreRawFile(source.absPath, originalRaw);
    throw new Error(`Validação falhou (relação não aplicada, nota restaurada):\n${validation.output}`);
  }

  return {
    path: source.relPath,
    relation,
    validation: "ok",
    warnings,
  };
}
