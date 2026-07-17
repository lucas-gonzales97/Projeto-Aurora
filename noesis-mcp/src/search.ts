import type { ParsedNote } from "./vault.js";

export interface SearchHit {
  id: string | null;
  path: string;
  type: string | null;
  status: string | null;
  title: string;
  snippet: string;
  score: number;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9áàâãéêíóôõúüç_-]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** First markdown heading, falling back to the first non-empty line. */
export function extractTitle(body: string): string {
  const headingMatch = body.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = body.split("\n").find((l) => l.trim().length > 0);
  return firstLine?.trim() ?? "";
}

function snippetAround(body: string, tokens: string[]): string {
  const lower = body.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const found = lower.indexOf(t);
    if (found !== -1 && (idx === -1 || found < idx)) idx = found;
  }
  if (idx === -1) {
    return body.trim().slice(0, 160).replace(/\s+/g, " ");
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + 100);
  return (start > 0 ? "…" : "") + body.slice(start, end).replace(/\s+/g, " ").trim() + (end < body.length ? "…" : "");
}

export function scoreNote(note: ParsedNote, query: string): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const id = String(note.data?.id ?? "").toLowerCase();
  const frontmatterBlob = JSON.stringify(note.data ?? {}).toLowerCase();
  const bodyBlob = note.body.toLowerCase();

  let score = 0;
  for (const t of tokens) {
    if (id === query.toLowerCase()) score += 25;
    if (id.includes(t)) score += 6;
    if (frontmatterBlob.includes(t)) score += 3;
    const bodyMatches = bodyBlob.split(t).length - 1;
    score += Math.min(bodyMatches, 5) * 1;
  }
  return score;
}

export function toHit(note: ParsedNote, score: number, query: string): SearchHit {
  const tokens = tokenize(query);
  return {
    id: note.data?.id ?? null,
    path: note.relPath,
    type: note.data?.type ?? null,
    status: note.data?.status ?? null,
    title: extractTitle(note.body),
    snippet: snippetAround(note.body, tokens),
    score,
  };
}
