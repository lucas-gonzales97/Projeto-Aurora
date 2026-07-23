import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import matter from "gray-matter";
import { load as yamlLoad, dump as yamlDump, JSON_SCHEMA } from "js-yaml";
import { parseDocument } from "yaml";
import { validateFrontmatterFiles } from "./validateFrontmatter.js";

// JSON_SCHEMA (unlike the default core schema) has no !!timestamp type, so a bare
// `created: 2026-07-17` stays the string "2026-07-17" instead of becoming a JS Date
// (which would otherwise round-trip back to disk as "2026-07-17T00:00:00.000Z").
const FRONTMATTER_ENGINE = {
  parse: (s: string) => yamlLoad(s, { schema: JSON_SCHEMA }) as object,
  stringify: (obj: object) => yamlDump(obj, { schema: JSON_SCHEMA, lineWidth: -1 }),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// noesis-mcp/ lives one level inside the vault (noesis-mcp/src/vault.ts -> vault root is two levels up).
export const VAULT_ROOT = process.env.NOESIS_VAULT_ROOT
  ? path.resolve(process.env.NOESIS_VAULT_ROOT)
  : path.resolve(__dirname, "..", "..");

// Mirrors scripts/validate_frontmatter.py so "what counts as a note" never drifts between the two.
const IGNORED_DIRS = new Set([".git", ".obsidian", "node_modules", "scripts", "events", "research"]);
const IGNORED_FILES = new Set(["SETUP.md", "README.md", "CLAUDE.md", "00-INDEX.md"]);

export class VaultPathError extends Error {}
export class NoteNotFoundError extends Error {}

/** Resolves a vault-relative path, guaranteeing the result never escapes VAULT_ROOT. */
export function safeResolve(relPath: string): string {
  const abs = path.resolve(VAULT_ROOT, relPath);
  const rootWithSep = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep;
  if (abs !== VAULT_ROOT && !abs.startsWith(rootWithSep)) {
    throw new VaultPathError(`Caminho fora do vault: ${relPath}`);
  }
  return abs;
}

export function toRelPath(absPath: string): string {
  return path.relative(VAULT_ROOT, absPath).split(path.sep).join("/");
}

function isIgnored(relParts: string[], fileName: string): boolean {
  if (relParts.some((part) => IGNORED_DIRS.has(part))) return true;
  if (IGNORED_FILES.has(fileName)) return true;
  return false;
}

/** Lists every non-ignored .md file in the vault, as absolute paths. */
export function listNoteFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const relParts = toRelPath(abs).split("/");
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        if (isIgnored(relParts.slice(0, -1), entry.name)) continue;
        out.push(abs);
      }
    }
  };
  walk(VAULT_ROOT);
  return out;
}

export interface ParsedNote {
  absPath: string;
  relPath: string;
  data: Record<string, any>;
  body: string;
}

export function readNoteFile(absPath: string): ParsedNote {
  const raw = fs.readFileSync(absPath, "utf-8");
  const { data, content } = matter(raw, { engines: { yaml: FRONTMATTER_ENGINE } });
  return { absPath, relPath: toRelPath(absPath), data, body: content.replace(/^\n+/, "") };
}

/** Writes a brand-new note (or a full rewrite where preserving prior formatting doesn't apply). */
export function writeNoteFile(absPath: string, data: Record<string, any>, body: string): void {
  const out = matter.stringify(`\n${body.replace(/^\n+/, "")}`, data, { engines: { yaml: FRONTMATTER_ENGINE } });
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, out, "utf-8");
}

/**
 * Appends one relation to an existing note's `relations:` list without touching
 * anything else in the frontmatter — a full parse+dump round-trip (writeNoteFile)
 * would reformat unrelated fields (quote style, folded long strings, etc.) on every
 * edit, which is exactly the kind of noisy diff this Git-versioned vault wants to avoid.
 * Returns the raw original file text, so the caller can restore it verbatim on rollback.
 */
export function appendRelation(absPath: string, relation: Record<string, any>): string {
  const raw = fs.readFileSync(absPath, "utf-8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new VaultPathError(`Nota sem frontmatter delimitado por ---: ${toRelPath(absPath)}`);
  const [, frontmatterText, rest] = match;

  const doc = parseDocument(frontmatterText);
  if (doc.get("relations") === undefined) {
    doc.set("relations", [relation]);
  } else {
    doc.addIn(["relations"], relation);
  }

  const newFrontmatter = doc.toString({ lineWidth: 0 });
  fs.writeFileSync(absPath, `---\n${newFrontmatter}---\n${rest}`, "utf-8");
  return raw;
}

export function restoreRawFile(absPath: string, raw: string): void {
  fs.writeFileSync(absPath, raw, "utf-8");
}

/** id -> ParsedNote, built fresh each call (vault is small; freshness beats caching for a local server). */
export function buildIndex(): Map<string, ParsedNote> {
  const index = new Map<string, ParsedNote>();
  for (const absPath of listNoteFiles()) {
    let note: ParsedNote;
    try {
      note = readNoteFile(absPath);
    } catch {
      continue;
    }
    const id = note.data?.id;
    if (typeof id === "string" && id) {
      index.set(id, note);
    }
  }
  return index;
}

/**
 * Resolves a note from either an `id` (looked up against frontmatter) or a
 * vault-relative `path` (extension optional). Throws NoteNotFoundError / VaultPathError.
 */
export function resolveNote(input: { id?: string; path?: string }): ParsedNote {
  if (input.id) {
    const note = buildIndex().get(input.id);
    if (!note) throw new NoteNotFoundError(`Nenhuma nota com id '${input.id}'`);
    return note;
  }
  if (input.path) {
    let rel = input.path;
    if (!rel.endsWith(".md")) rel += ".md";
    const abs = safeResolve(rel);
    if (!fs.existsSync(abs)) throw new NoteNotFoundError(`Nenhum arquivo em '${rel}'`);
    return readNoteFile(abs);
  }
  throw new VaultPathError("Forneça 'id' ou 'path'.");
}

// Antes shelava pra `python3 scripts/validate_frontmatter.py` — quebrava em
// qualquer máquina sem Python 3 (inviável pro Aurora Desktop empacotado,
// ver validateFrontmatter.ts e decisions/ADR-0008-vault-por-instalacao.md).
// Agora roda em processo, mesmas regras, sem dependência externa nenhuma.
export async function runValidator(absPaths: string[]): Promise<{ ok: boolean; output: string }> {
  return validateFrontmatterFiles(absPaths);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
