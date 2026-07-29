// Retrieval triplo (ADR-0010), versão plataforma-agnóstica (ADR-0016).
// Portado de noesis-mcp/src/{retrieval,search}.ts — MESMA matemática, sem `fs`:
// o timestamp de fallback vem de CoreNote.mtime, não do disco.
//
// score = w_rel·relevância + w_rec·recência + w_imp·importância (termos em
// [0,1], soma ponderada — forma do memory stream de Generative Agents). Com
// w_rec = w_imp = 0, a ordenação reproduz o comportamento pré-ADR-0010.

import type { CoreNote } from "./ports.js";

export interface RetrievalWeights { rel: number; rec: number; imp: number; }
export const DEFAULT_WEIGHTS: RetrievalWeights = { rel: 1.0, rec: 0.5, imp: 0.5 };
export const LEGACY_WEIGHTS: RetrievalWeights = { rel: 1.0, rec: 0, imp: 0 };
export const RECENCY_HALF_LIFE_DAYS = 30;
export const DEFAULT_IMPORTANCE = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---- relevância textual (era search.ts) ----
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9áàâãéêíóôõúüç_-]+/i).map((t) => t.trim()).filter(Boolean);
}

/** Primeiro heading markdown, ou a primeira linha não-vazia. */
export function extractTitle(body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
}

export function scoreNote(note: CoreNote, query: string): number {
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

// ---- termos recência/importância ----
/** Timestamp de referência: updated > created > mtime (da store, não do disco). */
export function noteTimestamp(note: CoreNote): Date {
  for (const field of ["updated", "created"]) {
    const v = note.data?.[field];
    if (typeof v === "string" && v) {
      const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return note.mtime;
}

/** Decaimento exponencial em [0,1]: 1 = agora, 0.5 = uma meia-vida atrás. */
export function recencyScore(ts: Date, now: Date = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - ts.getTime()) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** importance (0-10) → [0,1]; ausente/inválida = default 5. */
export function importanceScore(note: CoreNote): number {
  const raw = note.data?.importance;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : NaN;
  const clamped = Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_IMPORTANCE;
  return clamped / 10;
}

export interface TripleScore { final: number; relevance_norm: number; recency: number; importance: number; }

export function tripleScore(
  note: CoreNote, textScore: number, maxTextScore: number,
  weights: RetrievalWeights = DEFAULT_WEIGHTS, now: Date = new Date(),
): TripleScore {
  const relevance_norm = maxTextScore > 0 ? textScore / maxTextScore : 0;
  const recency = recencyScore(noteTimestamp(note), now);
  const importance = importanceScore(note);
  return {
    final: weights.rel * relevance_norm + weights.rec * recency + weights.imp * importance,
    relevance_norm, recency, importance,
  };
}
