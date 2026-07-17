import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { VAULT_ROOT } from "./vault.js";

interface RawOntology {
  entity_types: Record<string, Record<string, any>>;
  relation_kinds: Record<string, string>;
}

let cached: RawOntology | null = null;

function load(): RawOntology {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(VAULT_ROOT, "ontology", "ontology.yaml"), "utf-8");
  cached = loadYaml(raw) as RawOntology;
  return cached;
}

export interface EntityTypeSpec {
  requiredFields: string[];
  enums: Record<string, string[]>;
}

export function knownTypes(): string[] {
  return Object.keys(load().entity_types);
}

export function getEntityType(type: string): EntityTypeSpec | null {
  const spec = load().entity_types[type];
  if (!spec) return null;
  const { campos_obrigatorios, ...enums } = spec;
  return { requiredFields: campos_obrigatorios ?? [], enums };
}

export function knownRelationKinds(): string[] {
  return Object.keys(load().relation_kinds);
}
